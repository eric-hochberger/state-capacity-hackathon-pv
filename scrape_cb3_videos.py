#!/usr/bin/env python3
"""Catalog Manhattan CB3 committee meeting videos and download YouTube captions."""

import argparse
import json
import re
import threading
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PAGE = "https://www.nyc.gov/site/manhattancb3/minutes/committee-meeting-videos.page"
ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "cb3"
LISTINGS = OUT / "listings.json"
TRANSCRIPTS = OUT / "transcripts.jsonl"
SUMMARY = OUT / "summary.json"
WORKERS = 4

UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 14)"
print_lock = threading.Lock()
write_lock = threading.Lock()

COMMITTEE_RULES = [
    ("sla_licensing", ("sla", "licensing", "outdoor dining", "dca")),
    ("transportation_sanitation", ("transportation", "sanitation", "public safety")),
    ("parks_waterfront", ("parks", "waterfront", "resiliency", "waterfont")),
    ("land_use_housing", ("land use", "zoning", "housing", "nycha", "section 8")),
    ("health_human_services", ("health", "seniors", "human services", "youth", "education", "human rights")),
    ("economic_development", ("economic dev",)),
    ("landmarks", ("landmark",)),
    ("arts_culture", ("arts", "cultural")),
    ("executive", ("executive",)),
    ("cannabis", ("cannabis",)),
    ("budget", ("budget", "public hearing")),
    ("charter", ("charter",)),
    ("bylaws", ("by-law", "bylaw")),
    ("outreach", ("outreach",)),
    ("personnel", ("personnel", "board member")),
]


def log(msg):
    with print_lock:
        print(msg, flush=True)


def fetch(url, data=None, headers=None, timeout=60, retries=5):
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (429, 500, 502, 503, 504):
                raise
        except Exception as exc:
            last = exc
        time.sleep(1.5 * (attempt + 1))
    raise last


def video_id(href):
    parsed = urlparse(href)
    if "youtu.be" in parsed.netloc:
        return parsed.path.strip("/").split("/")[0]
    if "/live/" in parsed.path:
        return parsed.path.split("/live/")[-1].split("/")[0]
    return (parse_qs(parsed.query).get("v") or [None])[0]


def parse_date(text):
    cleaned = text.replace("020/", "02/")
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})\s*$", cleaned)
    if not match:
        return None, None
    month, day, year = (int(part) for part in match.groups())
    if year < 100:
        year += 2000
    try:
        iso = "{:04d}-{:02d}-{:02d}".format(year, month, day)
    except ValueError:
        return match.group(0).strip(), None
    return match.group(0).strip(), iso


def committees(title):
    haystack = title.lower()
    tags = [name for name, keys in COMMITTEE_RULES if any(key in haystack for key in keys)]
    return tags or ["other"]


def parse_listings(html):
    start = html.find("Click on a month")
    if start < 0:
        raise SystemExit("meeting list not found on page")
    chunk = html[start:]
    listings = []
    parts = re.split(r'<div class="faq-questions"[^>]*>', chunk)
    for part in parts[1:]:
        month_match = re.search(r"<p>(.*?)</p>", part, re.S)
        month = unescape(re.sub(r"<[^>]+>", "", month_match.group(1) if month_match else ""))
        month = re.sub(r"\s+", " ", month).strip()
        for li in re.findall(r"<li>(.*?)</li>", part, re.S):
            anchors = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', li, re.S)
            ids = []
            for href, anchor_text in anchors:
                label = unescape(re.sub(r"<[^>]+>", " ", anchor_text))
                if not re.sub(r"\s+", "", label):
                    continue
                vid = video_id(unescape(href))
                if vid and vid not in ids:
                    ids.append(vid)
            if not ids:
                continue
            plain = unescape(re.sub(r"<[^>]+>", " ", li))
            plain = re.sub(r"\s+", " ", plain).replace("\xa0", " ").strip(" -")
            date_text, iso = parse_date(plain)
            title = plain
            if date_text and plain.endswith(date_text):
                title = plain[: -len(date_text)].strip(" -")
            listings.append(
                {
                    "month": month,
                    "title": title,
                    "date_text": date_text,
                    "date": iso,
                    "committees": committees(title),
                    "youtube_ids": ids,
                    "urls": ["https://youtu.be/" + vid for vid in ids],
                }
            )
    return listings


def caption_cues(xml_bytes):
    root = ET.fromstring(xml_bytes)
    cues = []
    for node in root.findall("body/p"):
        text = unescape("".join(node.itertext()))
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue
        cues.append(
            {
                "t": int(node.get("t") or 0),
                "text": text,
            }
        )
    return cues


def fetch_video(video_id_value):
    body = json.dumps(
        {
            "context": {
                "client": {
                    "clientName": "ANDROID",
                    "clientVersion": "20.10.38",
                    "hl": "en",
                    "gl": "US",
                }
            },
            "videoId": video_id_value,
        }
    ).encode()
    raw = fetch(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": UA},
        timeout=45,
    )
    data = json.loads(raw)
    details = data.get("videoDetails") or {}
    status = (data.get("playabilityStatus") or {}).get("status")
    tracks = (
        (data.get("captions") or {})
        .get("playerCaptionsTracklistRenderer", {})
        .get("captionTracks")
        or []
    )
    track = None
    for candidate in tracks:
        if candidate.get("languageCode", "").startswith("en"):
            track = candidate
            break
    if track is None and tracks:
        track = tracks[0]
    cues = []
    caption_language = None
    caption_kind = None
    if track and track.get("baseUrl"):
        caption_language = track.get("languageCode")
        caption_kind = track.get("kind") or "manual"
        caption_xml = fetch(track["baseUrl"], headers={"User-Agent": UA}, timeout=90)
        cues = caption_cues(caption_xml)
    transcript = " ".join(cue["text"] for cue in cues)
    return {
        "youtube_id": video_id_value,
        "youtube_title": details.get("title"),
        "channel": details.get("author"),
        "duration_seconds": int(details["lengthSeconds"]) if details.get("lengthSeconds") else None,
        "view_count": int(details["viewCount"]) if str(details.get("viewCount") or "").isdigit() else None,
        "playability": status,
        "caption_language": caption_language,
        "caption_kind": caption_kind,
        "cue_count": len(cues),
        "word_count": len(transcript.split()) if transcript else 0,
        "cues": cues,
    }


def done_ids():
    found = set()
    if not TRANSCRIPTS.exists():
        return found
    with TRANSCRIPTS.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                found.add(json.loads(line)["youtube_id"])
            except (json.JSONDecodeError, KeyError):
                continue
    return found


def append_record(record):
    line = json.dumps(record, ensure_ascii=False) + "\n"
    with write_lock:
        with TRANSCRIPTS.open("a", encoding="utf-8") as handle:
            handle.write(line)


MONTHS = {
    name: index
    for index, name in enumerate(
        [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december",
        ],
        1,
    )
}


def date_from_title(title):
    if not title:
        return None
    numeric = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", title)
    if numeric:
        month, day, year = (int(part) for part in numeric.groups())
        if year < 100:
            year += 2000
        return "{:04d}-{:02d}-{:02d}".format(year, month, day)
    named = re.search(
        r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})",
        title,
        re.I,
    )
    if named:
        month = MONTHS[named.group(1).lower()]
        return "{:04d}-{:02d}-{:02d}".format(int(named.group(3)), month, int(named.group(2)))
    return None


def load_transcripts():
    by_id = {}
    if not TRANSCRIPTS.exists():
        return by_id
    with TRANSCRIPTS.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            by_id[row["youtube_id"]] = row
    return by_id


def backfill_dates(listings, by_id):
    for listing in listings:
        if listing.get("date"):
            continue
        for vid in listing["youtube_ids"]:
            row = by_id.get(vid) or {}
            iso = date_from_title(row.get("youtube_title"))
            if iso:
                listing["date"] = iso
                listing["date_text"] = listing.get("date_text") or iso
                break


def summarize(listings):
    by_id = load_transcripts()
    backfill_dates(listings, by_id)
    by_year = Counter()
    by_committee = Counter()
    hours_by_year = Counter()
    words = 0
    seconds = 0
    with_caption = 0
    missing = []
    seen = set()
    for listing in listings:
        year = listing["date"][:4] if listing.get("date") else "unknown"
        by_year[year] += 1
        for tag in listing["committees"]:
            by_committee[tag] += 1
        for vid in listing["youtube_ids"]:
            if vid in seen:
                continue
            seen.add(vid)
            row = by_id.get(vid)
            if not row:
                missing.append(vid)
                continue
            if row.get("cue_count"):
                with_caption += 1
            words += row.get("word_count") or 0
            duration = row.get("duration_seconds") or 0
            seconds += duration
            hours_by_year[year] += duration
    unique_ids = list(seen)
    summary = {
        "source": PAGE,
        "meetings": len(listings),
        "videos": len(unique_ids),
        "videos_with_captions": with_caption,
        "videos_missing_record": missing,
        "duration_hours": round(seconds / 3600, 1),
        "transcript_words": words,
        "meetings_by_year": dict(sorted(by_year.items())),
        "hours_by_year": {year: round(value / 3600, 1) for year, value in sorted(hours_by_year.items())},
        "meetings_by_committee": dict(by_committee.most_common()),
    }
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def main():
    parser = argparse.ArgumentParser(description="Catalog Manhattan CB3 meeting videos and captions.")
    parser.add_argument(
        "--month",
        help='Keep listings whose month label contains this text, e.g. "September 2026".',
    )
    parser.add_argument("--latest", action="store_true", help="Keep only the most recent meeting.")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    html = fetch(PAGE, headers={"User-Agent": "Mozilla/5.0"}).decode("utf-8", "replace")
    listings = parse_listings(html)
    if args.month:
        needle = args.month.lower()
        listings = [row for row in listings if needle in (row.get("month") or "").lower()]
        if not listings:
            raise SystemExit("no meetings matched --month {!r}".format(args.month))
    if args.latest:
        dated = [row for row in listings if row.get("date")]
        if not dated:
            raise SystemExit("no dated meetings to choose a latest from")
        listings = [max(dated, key=lambda row: row["date"])]
    LISTINGS.write_text(json.dumps(listings, indent=2) + "\n")
    ids = []
    seen = set()
    for listing in listings:
        for vid in listing["youtube_ids"]:
            if vid not in seen:
                seen.add(vid)
                ids.append(vid)
    finished = done_ids()
    pending = [vid for vid in ids if vid not in finished]
    log("meetings={} videos={} already={} pending={}".format(len(listings), len(ids), len(finished), len(pending)))
    errors = 0
    if pending:
        workers = 1 if args.latest else WORKERS
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(fetch_video, vid): vid for vid in pending}
            done = 0
            for future in as_completed(futures):
                vid = futures[future]
                done += 1
                try:
                    record = future.result()
                    append_record(record)
                    log(
                        "[{}/{}] {} cues={} words={} title={}".format(
                            done,
                            len(pending),
                            vid,
                            record["cue_count"],
                            record["word_count"],
                            record.get("youtube_title"),
                        )
                    )
                except Exception as exc:
                    errors += 1
                    log("[{}/{}] {} ERROR {}".format(done, len(pending), vid, exc))
    summary = summarize(listings)
    LISTINGS.write_text(json.dumps(listings, indent=2) + "\n")
    log("summary " + json.dumps({k: summary[k] for k in ("meetings", "videos", "videos_with_captions", "duration_hours", "transcript_words")}))
    if errors:
        raise SystemExit("{} videos failed".format(errors))


if __name__ == "__main__":
    main()
