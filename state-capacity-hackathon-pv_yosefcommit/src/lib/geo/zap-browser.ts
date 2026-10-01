import fs from "node:fs";
import path from "node:path";

export function zapBrowserDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../zap-browser"),
    path.resolve(process.cwd(), "zap-browser"),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("zap-browser directory not found");
  }
  return found;
}
