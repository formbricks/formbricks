// Serves the dev host, the built views (<dist>/views) and the fixtures.
// Usage: node dev/serve.mjs [port] [--dist=dist]
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] ?? 4173);
const distDir = process.argv.find((item) => item.startsWith("--dist="))?.slice("--dist=".length) ?? "dist";
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".cjs": "text/javascript",
  ".json": "application/json",
};

const resolveFile = (url) => {
  if (url === "/" || url === "/host.html") return path.join(root, "dev", "host.html");
  if (url === "/host.js") return path.join(root, "dev", "host.js");
  if (url.startsWith("/views/")) return path.join(root, distDir, url);
  if (url.startsWith("/fixtures/")) return path.join(root, "dev", url);
  // The survey renderer and its locale bundles, as the instance serves them (survey-preview view).
  if (url.startsWith("/js/")) return path.join(root, "..", "..", "apps", "web", "public", url);
  return null;
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost").pathname;
  const file = resolveFile(url);
  if (!file || file.includes("..")) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(file);
    response
      .writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
      .end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, () =>
  console.log(`Dev host on http://localhost:${port}/host.html?view=<name>&fixture=<name>`)
);
