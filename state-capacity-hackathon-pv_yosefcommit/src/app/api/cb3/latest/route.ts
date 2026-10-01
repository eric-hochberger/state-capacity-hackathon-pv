import { readFile } from "node:fs/promises";
import path from "node:path";

async function readJson(candidates: string[]) {
  for (const file of candidates) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return null;
}

export async function GET() {
  const meeting = await readJson([
    path.resolve(process.cwd(), "../data/cb3/latest.json"),
    path.resolve(process.cwd(), "data/cb3/latest.json"),
  ]);
  if (!meeting) return Response.json({ meeting: null });

  const date = typeof meeting.date === "string" ? meeting.date : "";
  const summary = date
    ? await readJson([
        path.resolve(process.cwd(), "../cb3_data/cb3/summaries", `${date}.json`),
        path.resolve(process.cwd(), "cb3_data/cb3/summaries", `${date}.json`),
      ])
    : null;
  if (summary) meeting.summary = summary;

  return Response.json({ meeting });
}
