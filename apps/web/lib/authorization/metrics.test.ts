import { beforeEach, describe, expect, test, vi } from "vitest";

const counters = new Map<string, { add: ReturnType<typeof vi.fn> }>();
const histograms = new Map<string, { record: ReturnType<typeof vi.fn> }>();

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn((name: string) => {
        const instrument = { add: vi.fn() };
        counters.set(name, instrument);
        return instrument;
      }),
      createHistogram: vi.fn((name: string) => {
        const instrument = { record: vi.fn() };
        histograms.set(name, instrument);
        return instrument;
      }),
    })),
  },
}));

const { recordAuthorizationComparison, recordAuthorizationDecision } = await import("./metrics");

beforeEach(() => {
  for (const instrument of counters.values()) instrument.add.mockClear();
  for (const instrument of histograms.values()) instrument.record.mockClear();
});

describe("authoritative authorization metrics", () => {
  test.each(["allow", "deny"] as const)("records a bounded %s decision and latency", (outcome) => {
    recordAuthorizationDecision({
      action: "survey.read",
      actorType: "user",
      durationMs: 125,
      outcome,
      resourceType: "survey",
      surface: "server_action",
    });

    expect(counters.get("formbricks_authzed_authorization_decisions_total")?.add).toHaveBeenCalledWith(1, {
      action: "survey.read",
      actor_type: "user",
      error_code: "none",
      outcome,
      resource_type: "survey",
      surface: "server_action",
    });
    expect(histograms.get("formbricks_authzed_authorization_duration_seconds")?.record).toHaveBeenCalledWith(
      0.125,
      {
        action: "survey.read",
        actor_type: "user",
        outcome,
        resource_type: "survey",
        surface: "server_action",
      }
    );
  });

  test("distinguishes an unscoped operational error from a product denial", () => {
    recordAuthorizationDecision({
      action: "workspace.read",
      actorType: "apiKey",
      durationMs: 10,
      errorCode: "authzed_unavailable",
      outcome: "operational_error",
      resourceType: "workspace",
      surface: "unscoped",
    });

    expect(counters.get("formbricks_authzed_authorization_decisions_total")?.add).toHaveBeenCalledWith(1, {
      action: "workspace.read",
      actor_type: "apiKey",
      error_code: "authzed_unavailable",
      outcome: "operational_error",
      resource_type: "workspace",
      surface: "unscoped",
    });
  });

  test("never lets a meter failure alter authorization flow", () => {
    counters.get("formbricks_authzed_authorization_decisions_total")?.add.mockImplementationOnce(() => {
      throw new Error("exporter unavailable");
    });

    expect(() =>
      recordAuthorizationDecision({
        action: "organization.read",
        actorType: "user",
        durationMs: 1,
        outcome: "allow",
        resourceType: "organization",
        surface: "page",
      })
    ).not.toThrow();
  });
});

describe("historical authorization comparison metrics", () => {
  test("uses a separate legacy histogram while bridge code remains", () => {
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

    expect(counters.get("formbricks_authzed_authorization_comparisons_total")?.add).toHaveBeenCalledOnce();
    expect(
      histograms.get("formbricks_authzed_authorization_comparison_duration_seconds")?.record
    ).toHaveBeenCalledWith(0.125, {
      mode: "shadow",
      outcome: "legacy_allow_authzed_deny",
      surface: "server_action",
    });
  });
});
