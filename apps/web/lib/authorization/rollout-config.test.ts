import { beforeEach, describe, expect, test, vi } from "vitest";
import { env } from "@/lib/env";
import { getAuthorizationRolloutConfig, matchesRolloutRule, targetsRolloutSurface } from "./rollout-config";

vi.mock("@/lib/env", () => ({
  env: {
    AUTHZED_AUTHORIZATION_COHORT: undefined,
    AUTHZED_AUTHORIZATION_ENABLED: undefined,
    AUTHZED_ENFORCEMENT_ORGANIZATION_IDS: undefined,
    AUTHZED_ENFORCEMENT_TARGETS: undefined,
    AUTHZED_SHADOW_ORGANIZATION_IDS: undefined,
    AUTHZED_SHADOW_TARGETS: undefined,
  },
}));

const rolloutEnv = env as typeof env & Record<string, string | undefined>;

beforeEach(() => {
  rolloutEnv.AUTHZED_AUTHORIZATION_COHORT = undefined;
  rolloutEnv.AUTHZED_AUTHORIZATION_ENABLED = undefined;
  rolloutEnv.AUTHZED_ENFORCEMENT_ORGANIZATION_IDS = undefined;
  rolloutEnv.AUTHZED_ENFORCEMENT_TARGETS = undefined;
  rolloutEnv.AUTHZED_SHADOW_ORGANIZATION_IDS = undefined;
  rolloutEnv.AUTHZED_SHADOW_TARGETS = undefined;
});

describe("authorization rollout configuration", () => {
  test("is disabled and empty by default", () => {
    expect(getAuthorizationRolloutConfig()).toEqual({
      cohort: "disabled",
      enabled: false,
      enforcement: { organizations: { all: false, ids: [] }, targets: [] },
      shadow: { organizations: { all: false, ids: [] }, targets: [] },
    });
  });

  test.each(["true", "1"])("enables authorization for %s", (enabled) => {
    rolloutEnv.AUTHZED_AUTHORIZATION_ENABLED = enabled;
    expect(getAuthorizationRolloutConfig().enabled).toBe(true);
  });

  test("trims and deduplicates targets and organization IDs", () => {
    rolloutEnv.AUTHZED_AUTHORIZATION_COHORT = "sandbox";
    rolloutEnv.AUTHZED_AUTHORIZATION_ENABLED = "true";
    rolloutEnv.AUTHZED_SHADOW_TARGETS = " server_action:user,api_v3:user,api_v9:user,server_action:user ";
    rolloutEnv.AUTHZED_SHADOW_ORGANIZATION_IDS = " org-1,org-2,org-1 ";

    expect(getAuthorizationRolloutConfig()).toMatchObject({
      cohort: "sandbox",
      enabled: true,
      shadow: {
        organizations: { all: false, ids: ["org-1", "org-2"] },
        targets: ["server_action:user", "api_v3:user"],
      },
    });
  });

  test("represents a wildcard organization allowlist without identifiers", () => {
    rolloutEnv.AUTHZED_ENFORCEMENT_TARGETS = "mcp:apiKey";
    rolloutEnv.AUTHZED_ENFORCEMENT_ORGANIZATION_IDS = "*";

    const { enforcement } = getAuthorizationRolloutConfig();
    expect(enforcement.organizations).toEqual({ all: true, ids: [] });
    expect(matchesRolloutRule(enforcement, "mcp:apiKey", "any-org")).toBe(true);
  });

  test("matches the Cartesian target and organization cohort", () => {
    rolloutEnv.AUTHZED_SHADOW_TARGETS = "server_action:user";
    rolloutEnv.AUTHZED_SHADOW_ORGANIZATION_IDS = "org-1";

    const { shadow } = getAuthorizationRolloutConfig();
    expect(targetsRolloutSurface(shadow, "server_action:user")).toBe(true);
    expect(matchesRolloutRule(shadow, "server_action:user", "org-1")).toBe(true);
    expect(matchesRolloutRule(shadow, "server_action:user", "org-2")).toBe(false);
    expect(matchesRolloutRule(shadow, "api_v3:user", "org-1")).toBe(false);
  });

  test("does not target a rollout surface without an organization cohort", () => {
    rolloutEnv.AUTHZED_SHADOW_TARGETS = "server_action:user";

    expect(targetsRolloutSurface(getAuthorizationRolloutConfig().shadow, "server_action:user")).toBe(false);
  });
});
