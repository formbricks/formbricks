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

// Guards the browser bundles the SDK packages copy into the web app (see ENG-2924).
//
// @formbricks/js-core and @formbricks/surveys build into their own `dist/` and then copy those files
// into apps/web/public/js via the shared `copy-compiled-assets` Vite plugin. Declaring only
// `dist/**` left the copied files out of the cache entry, so a cache hit restored a package tree
// without /js/formbricks.umd.cjs and /js/surveys.umd.cjs — Turbo reports "1 cached" and the running
// app requests a URL that is not there. Measured on a js-core cache entry: 178 files, all under
// packages/js-core/**, zero under apps/web/public/js.
//
// One writer per file. Turbo captures every file a task's globs match *after* the task runs, whoever
// wrote it, so a second task declaring the same paths yields entries whose contents depend on what
// happened to be on disk. Measured before this rule was pinned: with `surveys#build:dev` declaring the
// same globs as `surveys#build`, a dev run over a warm `dist` captured the production
// `surveys.umd.cjs` — a file that task never builds — into the very cache key a clean dev run fills
// with two files, and a dev cache hit then installed that production bundle. Ownership therefore stays
// with the shipping `build` tasks; a package's `build:dev` declares `dist/**` only, as it always did.
//
// Prefixes per package rather than one glob for the directory: both packages write into
// apps/web/public/js, and a directory-wide glob additionally lets one package's entry capture, and
// later restore, the other's files — a js-core cache hit was observed resurrecting a deleted
// surveys.umd.cjs. (A package's `dist/**` is still shared between its `build` and `build:dev`; that
// capture-side overlap predates this change and is not served to browsers.)
const PUBLIC_JS_DIR = "$TURBO_ROOT$/apps/web/public/js";

// The tasks that own files in apps/web/public/js. `build:dev` is deliberately absent: it copies
// through the same plugin, so declaring its paths would make it a second writer of the same files.
const BUNDLE_OUTPUTS: Record<string, string[]> = {
  "@formbricks/js-core#build": [`${PUBLIC_JS_DIR}/formbricks.*`],
  "@formbricks/surveys#build": [`${PUBLIC_JS_DIR}/surveys.*`, `${PUBLIC_JS_DIR}/validation.*`],
};

describe("turbo.json SDK bundle tasks declare the files they copy into apps/web/public/js", () => {
  const rootTasks = readTasks(rootTurboJsonPath);

  // These packages are not apps/web, so the package block (which REPLACES the shared `build` /
  // `build:dev` config) is the only override that can drop the globs today.
  const resolvedOutputsOf = (key: string): string[] => {
    const taskName = key.slice(key.indexOf("#") + 1);
    return rootTasks[key]?.outputs ?? rootTasks[taskName]?.outputs ?? [];
  };

  test("every bundle task declares its own public/js outputs", () => {
    const missing: string[] = [];
    for (const [key, required] of Object.entries(BUNDLE_OUTPUTS)) {
      const outputs = resolvedOutputsOf(key);
      for (const glob of required) {
        if (!outputs.includes(glob)) missing.push(`${key} → ${glob}`);
      }
    }
    expect(
      missing,
      `These cached build tasks write files their outputs do not declare: ${missing.join(", ")}. ` +
        "Turbo restores only declared outputs, so a cache hit silently drops the served bundle (ENG-2924)."
    ).toEqual([]);
  });

  test("bundle tasks still cache their own dist output", () => {
    const missingDist = Object.keys(BUNDLE_OUTPUTS).filter(
      (key) => !resolvedOutputsOf(key).includes("dist/**")
    );
    expect(
      missingDist,
      `These tasks no longer declare dist/**: ${missingDist.join(", ")}. ` +
        "Declaring the copied bundles must not come at the cost of the package's own build output."
    ).toEqual([]);
  });

  test("no bundle task claims the whole public/js directory", () => {
    // Two writers, one directory: a directory-wide glob makes one task's cache entry capture the
    // other task's files and restore them — possibly stale — over the top.
    const overlapping = Object.keys(BUNDLE_OUTPUTS).flatMap((key) =>
      resolvedOutputsOf(key)
        .filter((glob) => glob.startsWith(PUBLIC_JS_DIR))
        .filter((glob) => glob.endsWith("**"))
        .map((glob) => `${key} → ${glob}`)
    );
    expect(
      overlapping,
      `These outputs claim all of apps/web/public/js: ${overlapping.join(", ")}. ` +
        "Scope each task to the filenames it copies, or one package's cache hit restores the other's artifacts (ENG-2924)."
    ).toEqual([]);
  });

  test("every public/js output is declared by the one task that owns it", () => {
    // The failure this pins, measured: two tasks declaring overlapping public/js globs each capture
    // whatever the other left behind, so the same cache key holds different bytes from one run to the
    // next and a hit can install the other task's — here, a production bundle — output.
    //
    // Comparing globs for equality would not catch it: `formbricks.*` and `formbricks.umd.cjs` are
    // different strings that match the same file, so a second writer can be added without ever
    // colliding textually. Pin the whole surface instead — every public/js glob anywhere in the file
    // has to be one of the pairs above, declared by exactly that task and exactly once. A duplicate,
    // a narrower pattern under an existing prefix, and a new task copying into the directory all land
    // here as `unexpected`.
    const owned = new Set(
      Object.entries(BUNDLE_OUTPUTS).flatMap(([taskName, globs]) =>
        globs.map((glob) => `${taskName} → ${glob}`)
      )
    );

    const declared = Object.entries(rootTasks).flatMap(([taskName, task]) =>
      (task.outputs ?? [])
        .filter((glob) => glob.startsWith(PUBLIC_JS_DIR))
        .map((glob) => `${taskName} → ${glob}`)
    );

    const unexpected = declared.filter((entry) => !owned.has(entry));
    const duplicated = declared.filter((entry, index) => declared.indexOf(entry) !== index);

    expect(
      [...unexpected, ...duplicated],
      `public/js outputs that no task owns, or that one task declares twice: ${[...unexpected, ...duplicated].join("; ")}. ` +
        "Turbo captures by glob after the task runs, so a second writer's files land in the first " +
        "task's cache entry and a hit restores them. Add the path to BUNDLE_OUTPUTS under its single " +
        "owning task, or do not declare it (ENG-2924)."
    ).toEqual([]);
  });
});
