import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Guards the coupling between next.config.mjs and the web build task (see ENG-1663): every env var
// read in next.config.mjs shapes the build output, so it must be part of Turborepo's cache key. A
// var that is missing from the web build task's `env` (or filed under `passThroughEnv`) makes
// Turborepo — the local cache and the CI build-output cache alike — replay stale builds when the
// var's value changes.
//
// Web-only vars live in apps/web/turbo.json (ENG-1682) so that changing one does not bust every
// package's build cache, and so that editing them does not touch the root turbo.json, which is a
// `globalDependencies` entry and therefore invalidates the whole graph.
//
// The load-bearing detail: Turbo resolves a package config's task against the root task **per key
// and without merging list values**. `env` and `passThroughEnv` declared in apps/web/turbo.json
// therefore REPLACE the root `build` lists rather than extending them — anything the shared task
// declares has to be repeated in the web task or the web build silently loses it. The superset
// tests below are what keep that from regressing.
//
// Precedence per key, highest first: apps/web/turbo.json `build` → root `@formbricks/web#build` →
// root `build`. Verified empirically against turbo 2.9.14 with
// `turbo run build --dry=json --filter=@formbricks/web`: a root `@formbricks/web#build` override
// beats the shared task but loses to the package config, and it applies per key, so it still supplies
// any key the package config omits.

const here = path.dirname(fileURLToPath(import.meta.url));
const nextConfigPath = path.resolve(here, "..", "next.config.mjs");
const repoRoot = path.resolve(here, "..", "..", "..");
const rootTurboJsonPath = path.join(repoRoot, "turbo.json");
const webTurboJsonPath = path.join(repoRoot, "apps", "web", "turbo.json");

// Matches `process.env.X` and `process.env["X"]`/`process.env['X']`. Destructuring
// (`const { X } = process.env`) is intentionally not detected — next.config.mjs must read env vars
// directly (see the note in that file) so this guardrail stays reliable.
const getProcessEnvReads = (source: string): string[] => {
  const reads = new Set<string>();
  const pattern = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\])/g;
  for (const match of source.matchAll(pattern)) {
    reads.add(match[1] ?? match[2]);
  }
  return [...reads].sort();
};

interface TaskConfig {
  env?: string[];
  passThroughEnv?: string[];
}

const readTasks = (filePath: string): Record<string, TaskConfig> =>
  (JSON.parse(fs.readFileSync(filePath, "utf-8")) as { tasks?: Record<string, TaskConfig> }).tasks ?? {};

describe("web build env stays in sync with next.config.mjs", () => {
  const nextConfigSource = fs.readFileSync(nextConfigPath, "utf-8");
  const rootTasks = readTasks(rootTurboJsonPath);
  const webTasks = readTasks(webTurboJsonPath);

  const sharedBuildTask = rootTasks.build ?? {};

  // Resolved per key rather than per task, matching Turbo (see the precedence note above): picking a
  // whole task object would report an empty list for any key the package config happens to omit.
  const resolveWebBuild = (key: keyof TaskConfig): string[] =>
    webTasks.build?.[key] ?? rootTasks["@formbricks/web#build"]?.[key] ?? sharedBuildTask[key] ?? [];

  const webBuildEnv = resolveWebBuild("env");
  const webPassThroughEnv = resolveWebBuild("passThroughEnv");
  const sharedBuildEnv = sharedBuildTask.env ?? [];
  const sharedPassThroughEnv = sharedBuildTask.passThroughEnv ?? [];

  test("every process.env read in next.config.mjs is hashed by the web build task", () => {
    const reads = getProcessEnvReads(nextConfigSource);
    expect(reads.length).toBeGreaterThan(0);

    const missing = reads.filter((name) => !webBuildEnv.includes(name));
    expect(
      missing,
      `next.config.mjs reads env var(s) not hashed by the web build task: ${missing.join(", ")}. ` +
        "Add them to apps/web/turbo.json tasks.build.env (NOT passThroughEnv), or cached builds go stale."
    ).toEqual([]);
  });

  test("no var is listed in both env and passThroughEnv in the web build task", () => {
    const overlap = webBuildEnv.filter((name) => webPassThroughEnv.includes(name));
    expect(overlap).toEqual([]);
  });

  test("the web build task repeats every hashed env var from the shared build task", () => {
    // Turbo overrides rather than merges, so a var only on the shared task is NOT part of the web
    // build's cache key.
    const missing = sharedBuildEnv.filter((name) => !webBuildEnv.includes(name));
    expect(
      missing,
      `Shared build task hashes env var(s) the web build task drops: ${missing.join(", ")}. ` +
        "apps/web/turbo.json tasks.build.env overrides the shared list, so it must repeat these."
    ).toEqual([]);
  });

  test("the web build task repeats every passThroughEnv var from the shared build task", () => {
    // Same override trap, with a sharper failure mode: env mode is strict, so a var missing here is
    // stripped from the web build's environment entirely and the build fails or misconfigures.
    const missing = sharedPassThroughEnv.filter((name) => !webPassThroughEnv.includes(name));
    expect(
      missing,
      `Shared build task passes through var(s) the web build task drops: ${missing.join(", ")}. ` +
        "apps/web/turbo.json tasks.build.passThroughEnv overrides the shared list, so it must repeat these."
    ).toEqual([]);
  });

  test("the shared build task hashes only vars that are not web-specific", () => {
    // A web-only var on the shared task busts every package's build cache when it changes. Which
    // vars are genuinely shared is a judgement call, so this pins the reviewed set explicitly.
    expect([...sharedBuildEnv].sort((a, b) => a.localeCompare(b))).toEqual(["NODE_ENV", "S3_ENDPOINT_URL"]);
  });
});
