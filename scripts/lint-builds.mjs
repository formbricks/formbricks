import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/*
 * The workspace packages whose built `dist/` the type-aware lint reads types from: the builds the
 * `//#lint:code` Turbo task depends on. Without them tsgolint resolves those imports to an error type
 * that acts as `any`, and rules like no-unnecessary-type-assertion report code that is fine.
 */
export function lintBuildPackages(root) {
  const turbo = JSON.parse(readFileSync(path.join(root, "turbo.json"), "utf8"));
  return turbo.tasks["//#lint:code"].dependsOn
    .filter((dependency) => dependency.endsWith("#build"))
    .map((dependency) => dependency.slice(0, -"#build".length));
}

/** The packages from `lintBuildPackages` that have no `dist/` yet, as in a fresh clone. */
export function missingLintBuilds(root) {
  return lintBuildPackages(root).filter(
    (name) => !existsSync(path.join(root, "packages", name.replace(/^@formbricks\//, ""), "dist"))
  );
}

export const missingBuildsHint = (missing) =>
  `Type-aware lint reads the built types of ${missing.join(", ")}, which have no dist/ yet, so the ` +
  "errors above may be false. Build them with `pnpm build --filter=@formbricks/web^...` and commit again.";
