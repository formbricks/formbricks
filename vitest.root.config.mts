import { defineConfig } from "vitest/config";

// Tests for repo-level scripts that belong to no workspace (scripts/, .github/actions/). The
// `//#test:root` Turbo task runs them as part of `pnpm test`.
//
// Deliberately not named `vitest.config.*`: an auto-discovered root config would also apply to
// ad-hoc `vitest run <file>` calls made from the repo root (docker-build-validation.yml does one)
// and silently filter out every file outside this include.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts", ".github/**/*.test.ts"],
  },
});
