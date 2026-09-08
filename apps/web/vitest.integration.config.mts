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
      // `@formbricks/database` ships RAW TypeScript for these two subpath patterns, so anything that
      // transitively imports one (the response and survey services both do, via
      // `@formbricks/database/types/error`) gets externalised to Node, which parses the `.ts` as
      // JavaScript and dies at module load with a bare `SyntaxError: Unexpected token ':'` — no stack,
      // no filename. Mapping them to source makes vite transform them instead. ENG-2103 records the
      // root cause and the real fix (stop shipping raw `.ts`), which is bigger than this harness.
      {
        find: /^@formbricks\/database\/types\/(.*)$/,
        replacement: resolve(here, "../../packages/database/types/$1.ts"),
      },
      {
        find: /^@formbricks\/database\/zod\/(.*)$/,
        replacement: resolve(here, "../../packages/database/zod/$1.ts"),
      },
    ],
  },
  test: {
    // Needed alongside the aliases above: without inlining, the mapped modules are still handed to Node
    // rather than transformed.
    server: { deps: { inline: true } },
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
