import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPOSITORY_ROOT = join(WEB_ROOT, "../..");
const IGNORED_DIRECTORIES = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
]);

const walkRuntimeSources = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : walkRuntimeSources(absolutePath);
    }
    if (!/\.(ts|tsx|mjs)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return [];
    return [absolutePath];
  });

describe("authorization runtime selection", () => {
  test("keeps legacy authorization behind the compile-time bridge module", () => {
    const coordinator = readFileSync(join(WEB_ROOT, "lib/authorization/coordinator.ts"), "utf8");
    const targetRuntime = readFileSync(join(WEB_ROOT, "lib/authorization/runtime-evaluator.ts"), "utf8");
    const bridgeRuntime = readFileSync(
      join(WEB_ROOT, "lib/authorization/runtime-evaluator.bridge.ts"),
      "utf8"
    );

    expect(coordinator).toContain('from "@formbricks/authorization-runtime"');
    expect(coordinator).not.toContain("legacyEvaluator");
    expect(coordinator).not.toContain("spicedbEvaluator");
    expect(targetRuntime).toContain("spicedbEvaluator");
    expect(targetRuntime).not.toContain("legacyEvaluator");
    expect(bridgeRuntime).toContain("legacyEvaluator");
    expect(bridgeRuntime).not.toContain("spicedbEvaluator");
  });

  test("keeps production paths free of deleted compatibility entry points", () => {
    const forbiddenSymbols = [
      "checkAuthorizationUpdated",
      "hasUserWorkspaceAccessForAction",
      "hasApiKeyWorkspaceAccess",
      "observeWorkspaceListAuthorization",
    ];
    const allowedFiles = new Set([
      "lib/authorization/legacy-evaluator.ts",
      "lib/authorization/legacy-workspace-access.ts",
    ]);
    const offenders = walkRuntimeSources(WEB_ROOT).filter((filePath) => {
      const relativePath = filePath.slice(WEB_ROOT.length + 1);
      if (allowedFiles.has(relativePath)) return false;
      const source = readFileSync(filePath, "utf8");
      return forbiddenSymbols.some((symbol) => source.includes(symbol));
    });

    expect(offenders.map((filePath) => filePath.slice(WEB_ROOT.length + 1))).toEqual([]);
  });

  test("does not accept historical shadow or enforcement configuration", () => {
    const configSources = [
      readFileSync(join(WEB_ROOT, "lib/env.ts"), "utf8"),
      readFileSync(join(WEB_ROOT, "turbo.json"), "utf8"),
      readFileSync(join(REPOSITORY_ROOT, "turbo.json"), "utf8"),
    ].join("\n");
    const forbiddenVariables = [
      "AUTHZED_AUTHORIZATION_ENABLED",
      "AUTHZED_SHADOW_TARGETS",
      "AUTHZED_SHADOW_ORGANIZATION_IDS",
      "AUTHZED_ENFORCEMENT_TARGETS",
      "AUTHZED_ENFORCEMENT_ORGANIZATION_IDS",
      "AUTHZED_AUTHORIZATION_COHORT",
      "AUTHZED_MINIMUM_SNAPSHOT",
    ];

    for (const variable of forbiddenVariables) {
      expect(configSources, variable).not.toContain(variable);
    }
  });
});
