import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Guards the Turborepo output exclusions for the web build (see ENG-1805). The generic `build`
// task must exclude `.next/cache/**` and `.next/dev/**` so Turbo never caches the transient
// Next.js cache and dev directories — otherwise they fill local and CI disks (regression of the
// ENG-1662 fix).
//
// `@formbricks/web` declares no `outputs` of its own today, so it inherits the shared `build` task.
// This resolves `outputs` the way Turbo actually does — apps/web/turbo.json `build` → root
// `@formbricks/web#build` → root `build`, per key, with a higher-precedence declaration REPLACING the
// list instead of merging into it — so neither kind of future override can silently drop the
// exclusions. Since ENG-1682 moved the web build's env into apps/web/turbo.json, that file is now the
// likelier place for such an override to appear. See lib/turbo-build-env.test.ts for the same trap on
// `env`/`passThroughEnv`.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const rootTurboJsonPath = path.join(repoRoot, "turbo.json");
const webTurboJsonPath = path.join(repoRoot, "apps", "web", "turbo.json");

const REQUIRED_EXCLUSIONS = ["!.next/cache/**", "!.next/dev/**"];

interface TaskConfig {
  outputs?: string[];
}

const readTasks = (filePath: string): Record<string, TaskConfig> =>
  (JSON.parse(fs.readFileSync(filePath, "utf-8")) as { tasks?: Record<string, TaskConfig> }).tasks ?? {};

describe("turbo.json web build excludes transient Next.js dirs", () => {
  const rootTasks = readTasks(rootTurboJsonPath);
  const webTasks = readTasks(webTurboJsonPath);

  const resolvedOutputs =
    webTasks.build?.outputs ?? rootTasks["@formbricks/web#build"]?.outputs ?? rootTasks.build?.outputs ?? [];

  test("resolved @formbricks/web#build outputs exclude .next/cache and .next/dev", () => {
    const missing = REQUIRED_EXCLUSIONS.filter((exclusion) => !resolvedOutputs.includes(exclusion));
    expect(
      missing,
      `@formbricks/web#build resolved outputs are missing exclusion(s): ${missing.join(", ")}. ` +
        "Add them to the build task's `outputs` array so Turbo does not cache transient Next.js dirs (ENG-1805)."
    ).toEqual([]);
  });

  test("still caches the deployable build artifacts", () => {
    expect(resolvedOutputs).toContain(".next/**");
    expect(resolvedOutputs).toContain("dist/**");
  });
});
