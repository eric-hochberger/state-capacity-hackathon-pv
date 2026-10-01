import { readFile } from "node:fs/promises";
import path from "node:path";
import { zapBrowserDir } from "@/lib/geo/zap-browser";

const FILES: Record<string, string> = {
  "": "index.html",
  "index.html": "index.html",
  "data.js": "data.js",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments = [] } = await params;
  const key = segments.join("/");
  if (key === "") {
    return Response.redirect(new URL("/map/index.html", _request.url), 307);
  }
  const file = FILES[key];
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const full = path.join(zapBrowserDir(), file);
  const body = await readFile(full);
  const type = file.endsWith(".js")
    ? "text/javascript; charset=utf-8"
    : "text/html; charset=utf-8";

  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-cache",
    },
  });
}
