import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Integration-test config (ENG-1054 Better Auth harness). Runs the REAL Better Auth handler against a
 * real Postgres (provisioned by integration/global-setup.ts) and the real Redis — NO database mock.
 *
 * Kept entirely separate from the unit config (vite.config.mts), whose vitestSetup.ts globally mocks
 * @formbricks/database. Run via `pnpm test:integration`.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      // The app tsconfig excludes integration files (so `next build` doesn't typecheck the Boolean-
      // shaped tests / the generated-on-demand client), but that also stops vite-tsconfig-paths from
      // mapping `@/` for them — so map it explicitly here.
      { find: /^@\//, replacement: `${here}/` },
      // Alias ONLY the bare specifier (not the /prisma or /prisma-adapter subpaths) to the Boolean
      // test client, so the real Better Auth instance creates/reads Users with emailVerified as a
      // Boolean — see integration/db-boolean.ts + gen-boolean-client.mjs.
      { find: /^@formbricks\/database$/, replacement: resolve(here, "integration/db-boolean.ts") },
    ],
  },
  test: {
    environment: "node",
    globalSetup: ["./integration/global-setup.ts"],
    setupFiles: ["./integration/setup.ts"],
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**", "playwright/**"],
    // All files share one test database → run them serially (vitest 4: top-level option).
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
