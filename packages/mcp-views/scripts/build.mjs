// Builds every view to one self-contained HTML file (scripts, styles and assets inlined, which is what an
// MCP Apps host's default CSP allows: `script-src 'self' 'unsafe-inline'`, `connect-src 'none'`), then
// writes `dist/index.js` exporting the documents as strings so apps/web can serve them without touching
// the filesystem at request time (a Next.js standalone server does not ship this package's files).
import react from "@vitejs/plugin-react";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewsDir = path.join(root, "src", "views");
// Several people (or agents) can build different views at once: `--out=dist-mine` redirects the output
// and `--only=<view>` builds a single view, so nobody deletes anyone else's `dist`. Only a full build
// writes the `index.js` the web app imports.
const argument = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const distDir = path.join(root, argument("out") ?? "dist");
const only = argument("only");
const stagingDir = path.join(distDir, ".staging");

const viewNames = JSON.parse(await readFile(path.join(root, "src", "views.json"), "utf8"));
if (!Array.isArray(viewNames) || viewNames.length === 0) {
  throw new Error("No view names found in src/views.json");
}
if (only && !viewNames.includes(only)) {
  throw new Error(`Unknown view for --only: ${only}`);
}
const selectedNames = only ? [only] : viewNames;

// The package ships the "with deps" builds of the ext-apps entry points: they inline the MCP SDK pieces
// the package lists only as peers, so a view needs nothing but this package at build time.
const alias = {
  "@modelcontextprotocol/ext-apps/react": "@modelcontextprotocol/ext-apps/react-with-deps",
};

const documents = {};
for (const name of selectedNames) {
  const outDir = path.join(stagingDir, name);
  await build({
    root: path.join(viewsDir, name),
    configFile: false,
    logLevel: "warn",
    plugins: [react(), viteSingleFile()],
    resolve: { alias },
    build: {
      outDir,
      emptyOutDir: true,
      target: "es2022",
      cssCodeSplit: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      chunkSizeWarningLimit: 4000,
      reportCompressedSize: false,
    },
  });
  documents[name] = await readFile(path.join(outDir, "index.html"), "utf8");
}

await mkdir(path.join(distDir, "views"), { recursive: true });
for (const [name, html] of Object.entries(documents)) {
  await writeFile(path.join(distDir, "views", `${name}.html`), html);
}
await rm(stagingDir, { recursive: true, force: true });

// One module per document and a dynamic import per name, so the MCP route only loads the view a request
// asks for instead of parsing every document at startup.
for (const [name, html] of Object.entries(documents)) {
  await writeFile(path.join(distDir, "views", `${name}.js`), `export default ${JSON.stringify(html)};\n`);
}
if (only) {
  console.log(
    `${only}: ${(Buffer.byteLength(documents[only]) / 1024).toFixed(0)} kB (partial build, no index.js)`
  );
  process.exit(0);
}
const loaders = viewNames
  .map((name) => `  ${JSON.stringify(name)}: () => import(${JSON.stringify(`./views/${name}.js`)}),`)
  .join("\n");
await writeFile(
  path.join(distDir, "index.js"),
  `export const VIEW_NAMES = ${JSON.stringify(viewNames)};
const LOADERS = {
${loaders}
};
export const getViewHtml = async (name) => {
  const load = LOADERS[name];
  if (!load) {
    throw new Error(\`Unknown view: \${name}\`);
  }
  return (await load()).default;
};
`
);
await writeFile(
  path.join(distDir, "index.d.ts"),
  `export type ViewName = ${viewNames.map((name) => JSON.stringify(name)).join(" | ")};
export declare const VIEW_NAMES: readonly ViewName[];
/** The single-file HTML document of a view, ready to serve as a \`text/html;profile=mcp-app\` resource. */
export declare const getViewHtml: (name: ViewName) => Promise<string>;
`
);

for (const [name, html] of Object.entries(documents)) {
  console.log(`${name}: ${(Buffer.byteLength(html) / 1024).toFixed(0)} kB`);
}
