import { beforeEach, describe, expect, test, vi } from "vitest";
import { runAuthzedOutboxCli } from "./outbox-cli";

const dependencies = {
  closeClient: vi.fn(),
  drain: vi.fn(),
  replay: vi.fn(),
  status: vi.fn(),
  writeOutput: vi.fn(),
};

describe("AuthZed outbox CLI", () => {
  beforeEach(() => vi.clearAllMocks());

  test("prints a healthy identifier-free status", async () => {
    dependencies.status.mockResolvedValue({
      deadLettered: 0,
      oldestPendingAgeSeconds: 4,
      overdueRevocations: 0,
      pending: 2,
      revocationsPastCritical: 0,
      revocationsPastWarning: 0,
    });

    await expect(runAuthzedOutboxCli({ action: "status" }, dependencies)).resolves.toBe(0);
    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      '{"deadLettered":0,"oldestPendingAgeSeconds":4,"overdueRevocations":0,"pending":2,"revocationsPastCritical":0,"revocationsPastWarning":0,"status":"healthy"}\n'
    );
    expect(dependencies.closeClient).toHaveBeenCalledOnce();
  });

  test("uses exit 2 for stale revocations without exposing rows", async () => {
    dependencies.status.mockResolvedValue({
      deadLettered: 1,
      oldestPendingAgeSeconds: 61,
      overdueRevocations: 1,
      pending: 1,
      revocationsPastCritical: 1,
      revocationsPastWarning: 1,
    });

    await expect(runAuthzedOutboxCli({ action: "status" }, dependencies)).resolves.toBe(2);
    const output = dependencies.writeOutput.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toEqual({
      deadLettered: 1,
      oldestPendingAgeSeconds: 61,
      overdueRevocations: 1,
      pending: 1,
      revocationsPastCritical: 1,
      revocationsPastWarning: 1,
      status: "critical",
    });
    expect(output).not.toContain("primaryId");
    expect(output).not.toContain("secondaryId");
  });

  test("drains and replays with stable exit codes", async () => {
    dependencies.drain.mockResolvedValue({
      claimed: 2,
      deadLettered: 0,
      delivered: 2,
      failed: 0,
      remaining: 0,
      status: "drained",
    });
    dependencies.replay.mockResolvedValue(3);

    await expect(runAuthzedOutboxCli({ action: "drain", maxBatches: 4 }, dependencies)).resolves.toBe(0);
    expect(dependencies.drain).toHaveBeenCalledWith(4);

    await expect(runAuthzedOutboxCli({ action: "replay" }, dependencies)).resolves.toBe(0);
    expect(dependencies.writeOutput).toHaveBeenLastCalledWith('{"replayed":3,"status":"replayed"}\n');
  });

  test("sanitizes unexpected failures", async () => {
    dependencies.status.mockRejectedValue(new Error("token and row identifier"));

    await expect(runAuthzedOutboxCli({ action: "status" }, dependencies)).resolves.toBe(1);
    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      '{"code":"authzed_internal","retryable":false,"status":"failed"}\n'
    );
  });
});
