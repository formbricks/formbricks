import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Documents and enforces the caching policy for turbo.json tasks (see ENG-1682).
//
// Caching decisions:
//
//   test / test:coverage — cache: false
//     Tests are side-effectful (network, file system, timing) and produce no deterministic
//     outputs. Caching would hide flaky failures and regressions. The root package.json
//     already runs `turbo run test --no-cache`; making it explicit in turbo.json removes
//     ambiguity and prevents accidental cached runs when invoking turbo directly.
//
//   db:seed — cache: false
//     Seeding is stateful and target-dependent: a cached run against one database replays as a
//     hit against another and silently seeds nothing. Seed scripts are also non-deterministic
//     (idempotency guards, random data, ALLOW_SEED), so cache: false is the only safe default.
//
//   db:push — cache: false
//     Runs `prisma db push --accept-data-loss` — a destructive schema operation that
//     must never replay a cache hit.
//
//   db:migrate:dev, db:migrate:deploy — cache: false
//     Migration is an irreversible DB state change; caching would silently skip
//     migrations against a fresh database.
//
//   dev, go, clean, db:up, db:down, db:start, db:setup, storybook — cache: false
//     All are either persistent (dev server) or side-effectful (Docker, file ops).

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const turboJsonPath = path.join(repoRoot, "turbo.json");
const webTurboJsonPath = path.join(repoRoot, "apps", "web", "turbo.json");

interface TurboTask {
  cache?: boolean;
  persistent?: boolean;
  env?: string[];
  inputs?: string[];
}

describe("turbo.json task caching policy", () => {
  const turboJson = JSON.parse(fs.readFileSync(turboJsonPath, "utf-8")) as {
    tasks: Record<string, TurboTask>;
  };

  const REQUIRED_UNCACHED = [
    "test",
    "test:coverage",
    "db:seed",
    "db:push",
    "db:migrate:dev",
    "db:migrate:deploy",
    "db:setup",
    "db:start",
    "db:up",
    "db:down",
    "clean",
    "dev",
    "go",
    "storybook",
  ];

  test("side-effectful and test tasks are explicitly uncached", () => {
    const cachedButShouldNotBe: string[] = [];
    for (const taskName of REQUIRED_UNCACHED) {
      const task = turboJson.tasks[taskName];
      if (!task || task.cache !== false) {
        cachedButShouldNotBe.push(taskName);
      }
    }
    expect(
      cachedButShouldNotBe,
      `These tasks must have "cache": false because they are either side-effectful ` +
        "(db operations, Docker, file deletion) or non-deterministic (tests). " +
        `Missing or cached: ${cachedButShouldNotBe.join(", ")}.`
    ).toEqual([]);
  });

  test("db:seed declares DATABASE_URL so strict env mode does not strip it", () => {
    // Not a cache-key concern — db:seed is uncached. Env mode is strict, so anything the seed
    // script may read has to be declared; today it also loads ../../.env via dotenv, and this keeps
    // the task working if that wrapper ever goes away.
    const dbSeed = turboJson.tasks["db:seed"];
    expect(dbSeed?.env, "db:seed must declare an env array").toBeDefined();
    expect(dbSeed.env).toContain("DATABASE_URL");
  });

  test("build task is cacheable (no cache: false)", () => {
    const buildTask = turboJson.tasks.build;
    expect(buildTask).toBeDefined();
    // build must NOT have cache: false — we want build outputs cached
    expect(buildTask.cache).toBeUndefined();
  });

  test("every build task that narrows inputs still starts from $TURBO_DEFAULT$", () => {
    // Without the $TURBO_DEFAULT$ sentinel, an `inputs` list of nothing but negations matches
    // nothing: Turbo hashes package.json alone and a source edit no longer busts the build cache,
    // so a cached artifact — including one holding a since-patched bug — replays forever.
    const webTurboJson = JSON.parse(fs.readFileSync(webTurboJsonPath, "utf-8")) as {
      tasks: Record<string, TurboTask>;
    };
    const missingSentinel = [
      ...Object.entries(turboJson.tasks),
      ...Object.entries(webTurboJson.tasks).map(
        ([name, task]) => [`apps/web/turbo.json#${name}`, task] as const
      ),
    ]
      .filter(([name]) => name.endsWith("build"))
      .filter(([, task]) => Array.isArray(task.inputs) && task.inputs.length > 0)
      .filter(([, task]) => !task.inputs!.includes("$TURBO_DEFAULT$"))
      .map(([name]) => name);

    expect(
      missingSentinel,
      `These build tasks declare inputs without "$TURBO_DEFAULT$": ${missingSentinel.join(", ")}. ` +
        "A negation-only inputs list hashes package.json and nothing else."
    ).toEqual([]);
  });

  test("the web build task repeats every input exclusion from the shared build task", () => {
    // Third instance of the same override trap (see turbo-build-env.test.ts): declaring `inputs` in
    // apps/web/turbo.json replaces the shared list, so an exclusion added to the root build task
    // would silently never reach the web build.
    const webTurboJson = JSON.parse(fs.readFileSync(webTurboJsonPath, "utf-8")) as {
      tasks: Record<string, TurboTask>;
    };
    const webInputs = webTurboJson.tasks.build?.inputs;
    if (!webInputs) return; // no override, nothing to drift

    const missing = (turboJson.tasks.build?.inputs ?? []).filter((p) => !webInputs.includes(p));
    expect(
      missing,
      `Shared build task declares input pattern(s) the web build task drops: ${missing.join(", ")}. ` +
        "apps/web/turbo.json tasks.build.inputs overrides the shared list, so it must repeat these."
    ).toEqual([]);
  });

  test("build task inputs exclude test files without excluding production source", () => {
    const inputs = turboJson.tasks.build?.inputs;
    expect(inputs, "build task must declare inputs to exclude test files from cache key").toBeDefined();

    const hasTestExclusion = inputs!.some((p) => p.startsWith("!") && p.includes("test"));
    expect(
      hasTestExclusion,
      "build.inputs must exclude test files (e.g. !**/*.test.*) so changing a test does not bust build cache"
    ).toBe(true);

    // `**/integration/**` reads like a test-harness pattern but also matches production source
    // (packages/types/integration/*, apps/web/lib/integration/*). Directory-name exclusions that
    // broad have to be scoped to the one package that owns the harness.
    expect(
      inputs!.filter((p) => p.startsWith("!") && p.includes("**/integration/")),
      "Exclude the integration-test harness from the owning package's turbo.json, not workspace-wide"
    ).toEqual([]);
  });
});
