import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { isAuthzedEnabled } from "./config";
import { drainAuthzedOutbox } from "./outbox-processor";
import { hasUnclaimedAuthzedOutboxEvent } from "./outbox-repository";
import {
  AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS,
  AUTHZED_OUTBOX_SAFETY_NET_UNCLAIMED_MS,
  runAuthzedOutboxSafetyNet,
  startAuthzedOutboxSafetyNet,
  stopAuthzedOutboxSafetyNet,
} from "./outbox-safety-net";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./outbox-processor", () => ({ drainAuthzedOutbox: vi.fn() }));
vi.mock("./outbox-repository", () => ({
  AUTHZED_OUTBOX_REVOCATION_WARNING_MS: 15_000,
  hasUnclaimedAuthzedOutboxEvent: vi.fn(),
}));

const drained = { claimed: 24, deadLettered: 0, delivered: 24, failed: 0, remaining: 0, status: "drained" };

/** Let the tick's promise chain run without advancing the clock to the next tick. */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("AuthZed projection outbox safety net", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(hasUnclaimedAuthzedOutboxEvent).mockResolvedValue(false);
    vi.mocked(drainAuthzedOutbox).mockResolvedValue(drained as never);
  });

  afterEach(async () => {
    await stopAuthzedOutboxSafetyNet();
    vi.useRealTimers();
  });

  test("delivers the backlog a stalled delivery job left behind, with no Redis involved", async () => {
    // formbricks#9697: the BullMQ worker stayed parked after a Redis blip, 24 events sat pending for
    // six hours, and only a manual `outbox drain` recovered. That drain is what the safety net runs.
    vi.mocked(hasUnclaimedAuthzedOutboxEvent).mockResolvedValue(true);
    startAuthzedOutboxSafetyNet();

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS);

    expect(hasUnclaimedAuthzedOutboxEvent).toHaveBeenCalledWith(AUTHZED_OUTBOX_SAFETY_NET_UNCLAIMED_MS);
    expect(drainAuthzedOutbox).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ delivered: 24, operation: "projection_outbox_safety_net", remaining: 0 }),
      expect.stringContaining("BullMQ delivery job is not keeping up")
    );
  });

  test("bounds a stalled revocation well inside the 60-second freshness guard", () => {
    // Worst case: the event turns claimable just after a probe, so it waits the threshold plus one
    // interval. That has to stay under the guard, or a stalled job is still a fail-closed outage.
    expect(AUTHZED_OUTBOX_SAFETY_NET_UNCLAIMED_MS + AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS).toBeLessThan(
      60_000
    );
  });

  test("stays idle while the delivery job keeps up", async () => {
    startAuthzedOutboxSafetyNet();

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS * 3);

    expect(hasUnclaimedAuthzedOutboxEvent).toHaveBeenCalledTimes(3);
    // A drain records the heartbeat the "delivery stopped" alert reads, so an idle safety net must not
    // drain, or it would hide a dead job on a quiet deployment.
    expect(drainAuthzedOutbox).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("does not touch PostgreSQL when AuthZed is disabled", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await runAuthzedOutboxSafetyNet();

    expect(hasUnclaimedAuthzedOutboxEvent).not.toHaveBeenCalled();
    expect(drainAuthzedOutbox).not.toHaveBeenCalled();
  });

  test("keeps ticking after PostgreSQL fails, and recovers once it is back", async () => {
    vi.mocked(hasUnclaimedAuthzedOutboxEvent)
      .mockRejectedValueOnce(new Error("connection terminated"))
      .mockResolvedValue(true);
    startAuthzedOutboxSafetyNet();

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: "Error", operation: "projection_outbox_safety_net" }),
      "AuthZed projection outbox safety net failed"
    );
    expect(drainAuthzedOutbox).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS);
    expect(drainAuthzedOutbox).toHaveBeenCalledOnce();
  });

  test("never stacks a second drain behind one still in progress", async () => {
    vi.mocked(hasUnclaimedAuthzedOutboxEvent).mockResolvedValue(true);
    let finish: () => void = () => undefined;
    vi.mocked(drainAuthzedOutbox).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve(drained as never);
      })
    );
    startAuthzedOutboxSafetyNet();

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS * 3);
    expect(drainAuthzedOutbox).toHaveBeenCalledOnce();

    finish();
    await flush();
    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS);
    expect(drainAuthzedOutbox).toHaveBeenCalledTimes(2);
  });

  test("stops taking work once the server is draining", async () => {
    vi.mocked(hasUnclaimedAuthzedOutboxEvent).mockResolvedValue(true);
    let draining = false;
    startAuthzedOutboxSafetyNet(() => !draining);

    draining = true;
    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS * 2);

    expect(hasUnclaimedAuthzedOutboxEvent).not.toHaveBeenCalled();
  });

  test("does not start a drain when shutdown begins while the probe is in flight", async () => {
    let draining = false;
    vi.mocked(hasUnclaimedAuthzedOutboxEvent).mockImplementation(() => {
      draining = true;
      return Promise.resolve(true);
    });
    startAuthzedOutboxSafetyNet(() => !draining);

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS);

    expect(hasUnclaimedAuthzedOutboxEvent).toHaveBeenCalledOnce();
    expect(drainAuthzedOutbox).not.toHaveBeenCalled();
  });

  test("starts one timer however often worker startup is retried", async () => {
    startAuthzedOutboxSafetyNet();
    startAuthzedOutboxSafetyNet();

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS);

    expect(hasUnclaimedAuthzedOutboxEvent).toHaveBeenCalledOnce();
  });

  test("stops polling once stopped", async () => {
    startAuthzedOutboxSafetyNet();
    await stopAuthzedOutboxSafetyNet();

    await vi.advanceTimersByTimeAsync(AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS * 2);

    expect(hasUnclaimedAuthzedOutboxEvent).not.toHaveBeenCalled();
  });
});
