import { beforeEach, describe, expect, test, vi } from "vitest";
import { recordAuthorizationComparison } from "./metrics";

const telemetry = vi.hoisted(() => ({ add: vi.fn(), record: vi.fn() }));

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn(() => ({ add: telemetry.add })),
      createHistogram: vi.fn(() => ({ record: telemetry.record })),
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorization comparison metrics", () => {
  test("records seconds with bounded attributes and no identifiers", () => {
    recordAuthorizationComparison({
      action: "survey.read",
      actorType: "user",
      authzedDecision: "deny",
      cohort: "sandbox_users",
      durationMs: 125,
      errorCode: "authzed_unavailable",
      errorSource: "authzed",
      legacyDecision: "allow",
      mode: "shadow",
      outcome: "legacy_allow_authzed_deny",
      resourceType: "survey",
      surface: "server_action",
    });

    const expectedAttributes = {
      action: "survey.read",
      actor_type: "user",
      authzed_decision: "deny",
      cohort: "sandbox_users",
      error_code: "authzed_unavailable",
      error_source: "authzed",
      legacy_decision: "allow",
      mode: "shadow",
      outcome: "legacy_allow_authzed_deny",
      resource_type: "survey",
      surface: "server_action",
    };
    expect(telemetry.add).toHaveBeenCalledWith(1, expectedAttributes);
    expect(telemetry.record).toHaveBeenCalledWith(0.125, expectedAttributes);
  });

  test("uses stable none labels when no operational error is present", () => {
    recordAuthorizationComparison({
      action: "workspace.read",
      actorType: "apiKey",
      authzedDecision: "allow",
      cohort: "sandbox_api_keys",
      durationMs: 10,
      legacyDecision: "allow",
      mode: "shadow",
      outcome: "match",
      resourceType: "workspace",
      surface: "api_v2",
    });

    const expectedAttributes = {
      action: "workspace.read",
      actor_type: "apiKey",
      authzed_decision: "allow",
      cohort: "sandbox_api_keys",
      error_code: "none",
      error_source: "none",
      legacy_decision: "allow",
      mode: "shadow",
      outcome: "match",
      resource_type: "workspace",
      surface: "api_v2",
    };
    expect(telemetry.add).toHaveBeenCalledWith(1, expectedAttributes);
    expect(telemetry.record).toHaveBeenCalledWith(0.01, expectedAttributes);
  });
});
