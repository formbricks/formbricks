import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPOSITORY_ROOT = join(WEB_ROOT, "../..");

const walkRuntimeSources = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return walkRuntimeSources(absolutePath);
    if (!/\.(ts|tsx|mjs)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return [];
    return [absolutePath];
  });

describe("direct-authority architecture", () => {
  test("does not retain a legacy evaluator or rollout selector module", () => {
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
