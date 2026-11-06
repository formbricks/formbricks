import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const WEB_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const WORKER_ENTRY = fileURLToPath(new URL("../upload-worker.ts", import.meta.url));

/**
 * `upload-worker.ts` bundled with everything it imports, the way the app's bundler builds it, so a
 * test can run it in a real thread: Vitest's own module loader does not reach into worker threads.
 * Nothing is stubbed, `server-only` included, so a worker that loads server code fails to start.
 */
export const bundleUploadWorker = async (): Promise<URL> => {
  const outDir = mkdtempSync(join(tmpdir(), "survey-import-upload-worker-"));
  await build({
    configFile: false,
    logLevel: "silent",
    root: WEB_ROOT,
    plugins: [tsconfigPaths()],
    build: {
      ssr: WORKER_ENTRY,
      outDir,
      target: "node24",
      copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: "upload-worker.mjs" } },
    },
    ssr: { noExternal: true },
  });
  return pathToFileURL(join(outDir, "upload-worker.mjs"));
};
