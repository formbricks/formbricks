import { describe, expect, test, vi } from "vitest";
import type { TAuthzedBackfillResult } from "./backfill";
import { runAuthzedUpgradeCli } from "./upgrade-cli";

const health = { latencyMs: 4, status: "healthy" } as const;
const schema = {
  differenceCount: 0,
  differenceKinds: {},
  remoteDigest: `sha256:${"a".repeat(64)}` as const,
  remoteState: "present",
  sourceDigest: `sha256:${"a".repeat(64)}` as const,
  status: "matched",
} as const;
const outbox = {
  deadLettered: 0,
  oldestPendingAgeSeconds: null,
  overdueRevocations: 0,
  pending: 0,
  revocationsPastCritical: 0,
  revocationsPastWarning: 0,
} as const;
const counters = {
  failed: 0,
  ignored: 0,
  invalid: 0,
  mismatchedParents: 0,
  mismatchedPermissions: 0,
  missing: 0,
  orphaned: 0,
  pruned: 0,
  reconciled: 0,
  scanned: 12,
  skipped: 0,
  unmanaged: 0,
} as const;

const audit = (status: TAuthzedBackfillResult["status"] = "reconciled"): TAuthzedBackfillResult => ({
  completedAtSnapshot: null,
  counters,
  failures: [],
  lastOrganizationId: "tenant_identifier_must_not_escape",
  mismatchedParents: [],
  mismatchedPermissions: [],
  mode: "dry_run",
  orphanScope: "all",
  orphans: [],
  scope: "all",
  status,
  truncated: false,
  unmanaged: [],
});

const dependencies = (overrides: Record<string, unknown> = {}) => {
  const outputs: string[] = [];

  return {
    outputs,
    values: {
      applySchema: vi.fn().mockResolvedValue({ ...schema, status: "unchanged" }),
      audit: vi.fn().mockResolvedValue(audit()),
      checkHealth: vi.fn().mockResolvedValue(health),
      checkSchema: vi.fn().mockResolvedValue(schema),
      closeClient: vi.fn(),
      configureBulkClient: vi.fn(),
      consistency: vi.fn().mockReturnValue("fully_consistent"),
      drainOutbox: vi.fn().mockResolvedValue({
        claimed: 2,
        deadLettered: 0,
        delivered: 2,
        failed: 0,
        remaining: 0,
        status: "drained",
      }),
      isEnabled: vi.fn().mockReturnValue(true),
      outboxStatus: vi.fn().mockResolvedValue(outbox),
      writeOutput: (output: string) => outputs.push(output),
      ...overrides,
    },
  };
};

describe("runAuthzedUpgradeCli", () => {
  test("reports a clean read-only preflight without tenant identifiers", async () => {
    const deps = dependencies();

    await expect(runAuthzedUpgradeCli({ action: "check" }, deps.values)).resolves.toBe(0);

    const result = JSON.parse(deps.outputs.join(""));
    expect(result).toMatchObject({
      audit: { counters, failureCount: 0, status: "reconciled", truncated: false },
      datastoreMigrations: "ready",
      health,
      outbox,
      schema,
      status: "ready",
    });
    expect(deps.outputs.join("")).not.toContain("tenant_identifier_must_not_escape");
    expect(deps.values.configureBulkClient).toHaveBeenCalledBefore(deps.values.checkHealth);
    expect(deps.values.closeClient).toHaveBeenCalledOnce();
  });

  test.each([
    [{ isEnabled: vi.fn().mockReturnValue(false) }, "authzed_disabled"],
    [{ consistency: vi.fn().mockReturnValue("minimize_latency") }, "authzed_failed_precondition"],
  ])("fails closed for unsafe configuration", async (override, code) => {
    const deps = dependencies(override);

    await expect(runAuthzedUpgradeCli({ action: "check" }, deps.values)).resolves.toBe(1);

    expect(JSON.parse(deps.outputs.join(""))).toEqual({ code, retryable: false, status: "failed" });
    expect(deps.values.checkHealth).not.toHaveBeenCalled();
  });

  test("prepares schema, drains delivery, reconciles, and verifies the final graph", async () => {
    const deps = dependencies();
    const digest = `sha256:${"b".repeat(64)}`;

    await expect(
      runAuthzedUpgradeCli({ action: "prepare", expectedCurrentDigest: digest }, deps.values)
    ).resolves.toBe(0);

    expect(deps.values.applySchema).toHaveBeenCalledWith(digest);
    expect(deps.values.drainOutbox).toHaveBeenCalledOnce();
    expect(deps.values.audit).toHaveBeenNthCalledWith(1, "apply", expect.any(Object));
    expect(deps.values.audit).toHaveBeenNthCalledWith(2, "dry_run", expect.any(Object));
    expect(JSON.parse(deps.outputs.join(""))).toMatchObject({ status: "prepared" });
  });

  test("blocks when the final audit still finds drift", async () => {
    const drifted = audit("drifted");
    const deps = dependencies({
      audit: vi.fn().mockResolvedValueOnce(audit()).mockResolvedValueOnce(drifted),
    });

    await expect(runAuthzedUpgradeCli({ action: "prepare" }, deps.values)).resolves.toBe(2);

    expect(JSON.parse(deps.outputs.join(""))).toMatchObject({
      audit: { status: "drifted" },
      status: "blocked",
    });
  });

  test("sanitizes unexpected failures", async () => {
    const deps = dependencies({ checkHealth: vi.fn().mockRejectedValue(new Error("raw secret")) });

    await expect(runAuthzedUpgradeCli({ action: "check" }, deps.values)).resolves.toBe(1);

    expect(JSON.parse(deps.outputs.join(""))).toEqual({
      code: "authzed_internal",
      retryable: false,
      status: "failed",
    });
    expect(deps.outputs.join("")).not.toContain("raw secret");
  });
});
