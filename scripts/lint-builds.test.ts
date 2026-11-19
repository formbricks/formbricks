import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { lintBuildPackages, missingBuildsHint, missingLintBuilds } from "./lint-builds.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("lintBuildPackages", () => {
  /*
   * apps/web lints with type information through the same built types its typecheck reads, so every
   * build its typecheck waits for has to be built before `pnpm lint` too. A missing one made CI's lint
   * report assertions on unresolved (`any`) types as unnecessary.
   */
  test("covers every build apps/web's typecheck depends on", () => {
    const turbo = JSON.parse(readFileSync(path.join(root, "turbo.json"), "utf8"));
    const webBuilds = turbo.tasks["@formbricks/web#typecheck"].dependsOn
      .filter((dependency: string) => dependency.endsWith("#build"))
      .map((dependency: string) => dependency.slice(0, -"#build".length));

    expect(lintBuildPackages(root)).toEqual(expect.arrayContaining(webBuilds));
  });

  // `--fix` acts on what the type-aware rules report, so it needs the same builds first: without them it
  // would "fix" assertions that only look unnecessary because the imported types did not resolve.
  test("`pnpm lint:fix` runs through the Turbo task that builds them", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

    expect(pkg.scripts["lint:fix"]).toBe("turbo run lint:code -- --fix");
  });
});

describe("missingLintBuilds", () => {
  let fixtureRoot: string | undefined;

  afterEach(() => {
    if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
    fixtureRoot = undefined;
  });

  test("names the packages the lint depends on that have no dist/", () => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "lint-builds-"));
    writeFileSync(
      path.join(fixtureRoot, "turbo.json"),
      JSON.stringify({
        tasks: {
          "//#lint:code": { dependsOn: ["@formbricks/ai#build", "@formbricks/jobs#build", "^typecheck"] },
        },
      })
    );
    mkdirSync(path.join(fixtureRoot, "packages", "ai", "dist"), { recursive: true });

    expect(missingLintBuilds(fixtureRoot)).toEqual(["@formbricks/jobs"]);
  });
});

test("the hint names the missing packages and the build command", () => {
  const hint = missingBuildsHint(["@formbricks/ai", "@formbricks/jobs"]);

  expect(hint).toContain("@formbricks/ai, @formbricks/jobs");
  expect(hint).toContain("pnpm build --filter=@formbricks/web^...");
});
