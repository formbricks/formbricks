import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createServer,
  createServerModuleRunner,
  defaultExternalConditions,
  defaultServerConditions,
} from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Run an `apps/web` script as ES modules, the way Vitest runs the app's tests:
 *
 *   tsx apps/web/scripts/run-esm-script.mts <script.ts> [args…]
 *
 * `tsx` alone loads every `.ts` of `apps/web` as CommonJS (the package has no `"type": "module"`), and
 * a CommonJS `require` cannot resolve a workspace package that only exports an `import` entry —
 * `@formbricks/ai`, `@formbricks/survey-ui/youtube-id` — so a script whose imports reach one stops with
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` before its first line. Here Vite's module runner loads the app's
 * modules as ES modules, resolves `@/` through `tsconfig.json`, and leaves packages to Node's own
 * `import`, so each resolves to the entry it exports.
 *
 * Modules resolve with the `react-server` condition, as the app's server code does (and as the other
 * scripts get it from `NODE_OPTIONS`), so `server-only` is the empty module it is on the server.
 *
 * The script must export `main`, which is awaited before the runner closes, and must not run anything
 * on import. Its arguments are in `process.argv` as if it had been run directly.
 */

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error("Usage: run-esm-script.mts <script.ts> [args…]");
  process.exit(1);
}
const entryPath = resolve(entry);
process.argv = [process.argv[0], entryPath, ...args];

const server = await createServer({
  configFile: false,
  root: webRoot,
  logLevel: "error",
  appType: "custom",
  plugins: [tsconfigPaths()],
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: {
    resolve: {
      conditions: [...defaultServerConditions, "react-server"],
      externalConditions: [...defaultExternalConditions, "react-server"],
    },
  },
});

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const script: { main?: unknown } = await runner.import(entryPath);
  if (typeof script.main !== "function") throw new Error(`${entry} does not export main()`);
  await script.main();
} finally {
  await server.close();
}
