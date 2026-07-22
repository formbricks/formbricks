import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Guards the Turborepo output exclusions for the web build (see ENG-1805). The generic `build`
// task must exclude `.next/cache/**` and `.next/dev/**` so Turbo never caches the transient
// Next.js cache and dev directories — otherwise they fill local and CI disks (regression of the
// ENG-1662 fix). Because `@formbricks/web` has no `#build` override today it inherits `build`,
// but this test resolves outputs the same way Turbo does so a future package-specific override
// cannot silently drop the exclusions again.

const here = path.dirname(fileURLToPath(import.meta.url));
const turboJsonPath = path.resolve(here, "..", "..", "..", "turbo.json");

const REQUIRED_EXCLUSIONS = ["!.next/cache/**", "!.next/dev/**"];

describe("turbo.json web build excludes transient Next.js dirs", () => {
  const turboJson = JSON.parse(fs.readFileSync(turboJsonPath, "utf-8")) as {
    tasks: Record<string, { outputs?: string[] }>;
  };

  // Turbo uses the package-specific task when defined, otherwise the generic one.
  const resolvedOutputs = turboJson.tasks["@formbricks/web#build"]?.outputs ?? turboJson.tasks.build.outputs ?? [];

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
