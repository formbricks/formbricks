import { beforeEach, describe, expect, test, vi } from "vitest";
import { runAuthzedBackfill } from "./backfill";
import { isAuthzedEnabled } from "./config";
import { recordAuthzedReconciliationAudit } from "./metrics";
import { pruneAuthzedOutboxHistory } from "./outbox-repository";
import { processAuthzedScheduledReconciliationJob } from "./scheduled-reconciliation";

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("./backfill", () => ({ runAuthzedBackfill: vi.fn() }));
vi.mock("./backfill-apply", () => ({
  createAuthzedBackfillApply: vi.fn(() => ({ mode: "apply" })),
  createAuthzedBackfillNoopApply: vi.fn(() => ({ mode: "dry_run" })),
}));
vi.mock("./client", () => ({ getAuthzedClient: vi.fn(() => ({ client: true })) }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./metrics", () => ({ recordAuthzedReconciliationAudit: vi.fn() }));
vi.mock("./outbox-repository", () => ({ pruneAuthzedOutboxHistory: vi.fn() }));

const result = (status: "drifted" | "failed" | "reconciled", missing = 0, mismatchedPermissions = 0) =>
  ({
    counters: { failed: status === "failed" ? 1 : 0, mismatchedPermissions, missing },
    status,
  }) as Awaited<ReturnType<typeof runAuthzedBackfill>>;

describe("scheduled AuthZed reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
  });

  test("does no database or AuthZed work when disabled", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await processAuthzedScheduledReconciliationJob();

    expect(runAuthzedBackfill).not.toHaveBeenCalled();
  });

  test("stops after one clean dry-run audit", async () => {
    vi.mocked(runAuthzedBackfill).mockResolvedValue(result("reconciled"));

    await processAuthzedScheduledReconciliationJob();

    expect(runAuthzedBackfill).toHaveBeenCalledOnce();
    expect(runAuthzedBackfill).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "dry_run", prune: false, scope: { kind: "all" } }),
      expect.any(Object)
    );
    expect(recordAuthzedReconciliationAudit).toHaveBeenCalledWith({
      drift: 0,
      failures: 0,
      status: "reconciled",
    });
    expect(pruneAuthzedOutboxHistory).toHaveBeenCalledOnce();
  });

  test("repairs attributable drift and verifies it with a second dry run", async () => {
    vi.mocked(runAuthzedBackfill)
      .mockResolvedValueOnce(result("drifted", 2, 1))
      .mockResolvedValueOnce(result("drifted"))
      .mockResolvedValueOnce(result("reconciled"));

    await processAuthzedScheduledReconciliationJob();

    expect(vi.mocked(runAuthzedBackfill).mock.calls.map(([request]) => request.mode)).toEqual([
      "dry_run",
      "apply",
      "dry_run",
    ]);
    expect(recordAuthzedReconciliationAudit).toHaveBeenCalledWith({
      drift: 3,
      failures: 0,
      status: "reconciled",
    });
  });
});
