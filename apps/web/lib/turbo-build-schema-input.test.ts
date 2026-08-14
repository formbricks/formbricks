import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Guards the coupling between `vite.authzed-cli.config.mts` and `turbo.json` (ENG-2340), the same
// shape as the next.config.mjs guard in `turbo-build-env.test.ts`.
//
// The web build reads the canonical authorization schema from the repo root at build time and emits
// it into the packaged operator CLI, so `formbricks-authzed schema check` / `apply` ship whatever
// that build captured. But `authzed/schema.zed` lives outside `apps/web`, and the `build` task
// declares no `inputs`, so Turbo hashes only files inside the package: without an explicit
// declaration the file that defines the shipped authorization semantics is hashed by nothing, and a
// warm cache is free to restore a CLI carrying the previous schema.
//
// This bit, concretely: a schema-only change (exactly what ENG-2340 is) touches no file under
// `apps/web`, so it is the case most likely to hit a cache that has no reason to miss.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const turboJsonPath = path.join(repoRoot, "turbo.json");
const cliConfigPath = path.join(repoRoot, "apps", "web", "vite.authzed-cli.config.mts");

const CANONICAL_SCHEMA = "authzed/schema.zed";

describe("turbo hashes the canonical AuthZed schema into the web build", () => {
  const turboJson = JSON.parse(fs.readFileSync(turboJsonPath, "utf-8")) as {
    globalDependencies?: string[];
    tasks: Record<string, { inputs?: string[] }>;
  };

  test("the CLI build still bundles the schema, so this guard still has a subject", () => {
    const cliConfig = fs.readFileSync(cliConfigPath, "utf-8");
    // If this ever stops being true the coupling is gone and the assertion below can be dropped —
    // but it should be dropped deliberately, not left asserting something that no longer exists.
    expect(cliConfig).toContain(CANONICAL_SCHEMA);
  });

  test("a schema-only change invalidates the cached web build", () => {
    // Either mechanism is fine; what matters is that the file is hashed somewhere that reaches
    // `@formbricks/web#build`. `globalDependencies` is the simpler of the two because package-scoped
    // task configs replace rather than merge, so an `inputs` override would have to restate the
    // whole build task.
    const globalDependencies = turboJson.globalDependencies ?? [];
    const buildInputs = turboJson.tasks["@formbricks/web#build"]?.inputs ?? [];

    const hashed =
      globalDependencies.includes(CANONICAL_SCHEMA) ||
      buildInputs.some((input) => input.endsWith(CANONICAL_SCHEMA));

    expect(
      hashed,
      `${CANONICAL_SCHEMA} is not hashed into @formbricks/web#build. Add it to turbo.json's ` +
        "`globalDependencies` (or to that task's `inputs`), or a cached build can ship a stale " +
        "authorization schema inside the packaged formbricks-authzed CLI (ENG-2340)."
    ).toBe(true);
  });
});
