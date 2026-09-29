import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Guards the workspace edge that makes @formbricks/vite-plugins an input to the packages that build
// with it (see ENG-2925).
//
// Several packages import shared build helpers through relative paths that escape their own
// directory (`../vite-plugins/node-next-dts`, `.../postcss-scope-fbjs.cjs`,
// `.../copy-compiled-assets`). Those helper files are hashed by nothing by default — `$TURBO_DEFAULT$`
// is package-relative — so Turbo hashes the importing package alone and a helper edit replays a build
// produced by the previous helper implementation.
//
// Declaring the dependency is what fixes it, but only together with a topological edge: a task's hash
// folds in the tasks named in `dependsOn`, so `"^build"` is what pulls `@formbricks/vite-plugins#build`
// into it (Turbo creates that node for the package even though it has no build script). A
// package-scoped `pkg#task` block REPLACES the shared task config per key, so a block listing only
// `@formbricks/<other>#build` drops the `^` edge and silently reintroduces the gap — measured on
// `@formbricks/cache#build`, whose hash stayed at `4ba016d7…` while `node-next-dts.ts` was edited, and
// moved only once `^build` was added beside it.
//
// Scope: `build` and `build:dev`, the cached tasks that read the helpers. `lint` still has the same
// shape of gap (the shared `lint` task declares no `dependsOn` at all) and is not covered here;
// `typecheck` does not, because it inherits `dependsOn: ["@formbricks/database#generate", "^typecheck"]`
// and @formbricks/vite-plugins defines a `typecheck` script, so the helper's contents already reach it.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const packagesRoot = path.join(repoRoot, "packages");
const rootTurboJsonPath = path.join(repoRoot, "turbo.json");

const HELPER_PACKAGE = "@formbricks/vite-plugins";
const HELPER_IMPORT = "../vite-plugins";
const BUILD_TASKS = ["build", "build:dev"];

// Files read while building: a reference in any of them means the helper's contents decide this
// package's build output.
const BUILD_CONFIG_FILE = /^(vite|postcss)\.config\.[cm]?[jt]s$/;

interface PackageManifest {
  name?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface TurboJson {
  tasks: Record<string, { dependsOn?: string[] }>;
}

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;

const turboJson = readJson<TurboJson>(rootTurboJsonPath);

const consumers = fs
  .readdirSync(packagesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packagesRoot, entry.name))
  .filter((dir) => fs.existsSync(path.join(dir, "package.json")))
  .map((dir) => ({
    dir,
    manifest: readJson<PackageManifest>(path.join(dir, "package.json")),
    references: fs
      .readdirSync(dir)
      .filter((file) => BUILD_CONFIG_FILE.test(file))
      .filter((file) => fs.readFileSync(path.join(dir, file), "utf-8").includes(HELPER_IMPORT))
      .sort(),
  }))
  .filter((consumer) => consumer.references.length > 0);

type Consumer = (typeof consumers)[number];

// Resolve `dependsOn` the way Turbo does: a package's own `turbo.json` wins, then the root `pkg#task`
// block, then the shared task config. The two rungs differ, and the difference is the override trap
// this test exists for: a root `pkg#task` block OVERWRITES the whole task config, inheriting nothing,
// while a package config merges per field and keeps the shared `dependsOn` unless it sets its own.
const resolvedDependsOn = (consumer: Consumer, task: string): string[] => {
  const packageTurboJsonPath = path.join(consumer.dir, "turbo.json");
  if (fs.existsSync(packageTurboJsonPath)) {
    const packageTask = readJson<TurboJson>(packageTurboJsonPath).tasks?.[task];
    if (packageTask) return packageTask.dependsOn ?? turboJson.tasks[task]?.dependsOn ?? [];
  }
  return (
    turboJson.tasks[`${consumer.manifest.name}#${task}`]?.dependsOn ?? turboJson.tasks[task]?.dependsOn ?? []
  );
};

describe("packages that build with @formbricks/vite-plugins edge it into the task graph", () => {
  test("the scan finds the known consumers", () => {
    // Without this, a scan that matched nothing would make every assertion below vacuous.
    const discovered = consumers.map((consumer) => consumer.manifest.name);
    expect(
      discovered,
      "No package was found importing ../vite-plugins from a build config. If the helpers moved, " +
        "update HELPER_IMPORT — do not delete the checks below."
    ).toEqual(
      expect.arrayContaining([
        "@formbricks/cache",
        "@formbricks/database",
        "@formbricks/js-core",
        "@formbricks/survey-ui",
        "@formbricks/surveys",
      ])
    );
  });

  test("every consumer declares the helper as a workspace dependency", () => {
    const undeclared = consumers
      .filter((consumer) => consumer.manifest.devDependencies?.[HELPER_PACKAGE] !== "workspace:*")
      .map((consumer) => `${consumer.manifest.name} (${consumer.references.join(", ")})`);
    expect(
      undeclared,
      `These packages build with ${HELPER_PACKAGE} without declaring it: ${undeclared.join(", ")}. ` +
        "They work only because pnpm hoists, and Turbo cannot see the edge (ENG-1681, ENG-2925)."
    ).toEqual([]);
  });

  test("every build task of a consumer carries the matching ^ edge", () => {
    const missingEdge: string[] = [];
    for (const consumer of consumers) {
      const packageName = consumer.manifest.name ?? "";
      for (const task of BUILD_TASKS) {
        if (!consumer.manifest.scripts?.[task]) continue;
        const dependsOn = resolvedDependsOn(consumer, task);
        if (!dependsOn.includes(`^${task}`)) missingEdge.push(`${packageName}#${task}`);
      }
    }
    expect(
      missingEdge,
      `These build tasks hash neither ${HELPER_PACKAGE} nor a task that reaches it: ${missingEdge.join(", ")}. ` +
        `Add "^build" / "^build:dev" to their dependsOn beside any other edge — a pkg#task block ` +
        "replaces the shared config, so the ^ entry has to be repeated (ENG-2925)."
    ).toEqual([]);
  });
});
