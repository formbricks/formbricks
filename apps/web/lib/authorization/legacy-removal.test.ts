import { existsSync, readFileSync, readdirSync } from "node:fs";
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

describe("temporary bridge architecture", () => {
  test("statically uses PostgreSQL for scalar and list decisions without a runtime engine switch", () => {
    const coordinator = readFileSync(join(WEB_ROOT, "lib/authorization/coordinator.ts"), "utf8");
    const list = readFileSync(join(WEB_ROOT, "lib/authorization/resource-list.ts"), "utf8");
    expect(coordinator).toContain("await bridgeEvaluator.can(");
    expect(list).toContain("await lookupBridgeResourceIds(");
    for (const file of ["coordinator.ts", "resource-list.ts", "bridge-evaluator.ts", "bridge-access.ts"]) {
      const source = readFileSync(join(WEB_ROOT, "lib/authorization", file), "utf8");
      expect(source).toContain('import "server-only"');
      for (const forbidden of [
        "spicedb-evaluator",
        "getAuthzedClient",
        "assertAuthzedProjectionFreshness",
        "process.env",
      ]) {
        expect(source, file).not.toContain(forbidden);
      }
    }
  });

  test("leaves the SpiceDB evaluator unreachable from runtime callers", () => {
    const callers = walkRuntimeSources(WEB_ROOT).filter((path) =>
      /from\s+["'][^"']*spicedb-evaluator["']/.test(readFileSync(path, "utf8"))
    );
    expect(callers).toEqual([]);
  });

  test("does not restore the historical compatibility helpers or rollout selector", () => {
    for (const relativePath of [
      "lib/authorization/legacy-evaluator.ts",
      "lib/authorization/legacy-api-key-access.ts",
      "lib/authorization/legacy-workspace-access.ts",
      "lib/authorization/rollout-config.ts",
      "lib/authorization/workspace-list-observer.ts",
      "lib/utils/action-client/action-client-middleware.ts",
    ]) {
      expect(existsSync(join(WEB_ROOT, relativePath)), relativePath).toBe(false);
    }
  });

  test("keeps production authorization paths free of deleted compatibility entry points", () => {
    const forbiddenSymbols = [
      "checkAuthorizationUpdated",
      "hasUserWorkspaceAccessForAction",
      "hasApiKeyWorkspaceAccess",
      "observeWorkspaceListAuthorization",
    ];
    const offenders = walkRuntimeSources(WEB_ROOT).filter((filePath) => {
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
