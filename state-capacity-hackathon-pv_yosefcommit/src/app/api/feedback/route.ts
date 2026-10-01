import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "feedback.json");
const PROJECT_ID = /^P?[0-9]{4}[A-Z][0-9]{3,5}$/;
const MAX_TEXT = 1000;

type Stance = "support" | "oppose";

interface Comment {
  id: string;
  stance: Stance;
  text: string;
  createdAt: string;
}

interface IssueComment {
  id: string;
  text: string;
  createdAt: string;
}

interface ProjectFeedback {
  support: number;
  oppose: number;
  comments: Comment[];
}

interface IssueFeedback {
  comments: IssueComment[];
}

interface StoreFile {
  projects: Record<string, ProjectFeedback>;
  issues: Record<string, IssueFeedback>;
}

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreFile>;
    return { projects: parsed.projects ?? {}, issues: parsed.issues ?? {} };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { projects: {}, issues: {} };
    throw err;
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(store), "utf8");
  await rename(tmp, FILE);
}

async function allowedIssueIds(): Promise<Set<string>> {
  const roots = [path.resolve(process.cwd(), ".."), process.cwd()];
  const ids = new Set<string>();
  for (const root of roots) {
    try {
      const latest = JSON.parse(
        await readFile(path.join(root, "data/cb3/latest.json"), "utf8")
      ) as { date?: string; youtube_id?: string };
      if (!latest.date || !latest.youtube_id) continue;
      const summary = JSON.parse(
        await readFile(path.join(root, "cb3_data/cb3/summaries", `${latest.date}.json`), "utf8")
      ) as { segments?: { id?: string }[] };
      for (const segment of summary.segments ?? []) {
        if (segment.id) ids.add(`${latest.youtube_id}:${segment.id}`);
      }
      if (ids.size) return ids;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return ids;
}

function emptyProject(): ProjectFeedback {
  return { support: 0, oppose: 0, comments: [] };
}

export async function GET() {
  const store = await readStore();
  return Response.json(store);
}

export async function POST(request: Request) {
  let body: { projectId?: unknown; issueId?: unknown; stance?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const issueId = typeof body.issueId === "string" ? body.issueId : "";
  const stance = body.stance === "support" || body.stance === "oppose" ? body.stance : null;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";

  if (issueId) {
    const allowed = await allowedIssueIds();
    if (!allowed.has(issueId)) {
      return Response.json({ error: "Unknown meeting issue." }, { status: 400 });
    }
    if (!text) {
      return Response.json({ error: "Write a comment first." }, { status: 400 });
    }
    const issue = await withLock(async () => {
      const store = await readStore();
      const current = store.issues[issueId] ?? { comments: [] };
      current.comments.unshift({
        id: randomUUID(),
        text,
        createdAt: new Date().toISOString(),
      });
      store.issues[issueId] = current;
      await writeStore(store);
      return current;
    });
    return Response.json({ issue });
  }

  if (!PROJECT_ID.test(projectId)) {
    return Response.json({ error: "Unknown application." }, { status: 400 });
  }
  if (!stance) {
    return Response.json(
      { error: "Choose support or don't support." },
      { status: 400 }
    );
  }

  const project = await withLock(async () => {
    const store = await readStore();
    const current = store.projects[projectId] ?? emptyProject();
    current[stance] += 1;
    if (text) {
      current.comments.unshift({
        id: randomUUID(),
        stance,
        text,
        createdAt: new Date().toISOString(),
      });
    }
    store.projects[projectId] = current;
    await writeStore(store);
    return current;
  });

  return Response.json({ project });
}
