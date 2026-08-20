import { describe, expect, test, vi } from "vitest";
import { runAuthzedCiOutboxWorker } from "./authzed-ci-outbox-worker-runner";

describe("AuthZed CI outbox worker runner", () => {
  test("recovers from an isolated unexpected failure", async () => {
    let stopped = false;
    const deliver = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("sensitive transport detail"))
      .mockResolvedValueOnce();
    const heartbeat = vi.fn(async () => {
      stopped = true;
    });
    const onUnexpectedFailure = vi.fn();
    const wait = vi.fn<() => Promise<void>>().mockResolvedValue();

    await runAuthzedCiOutboxWorker({
      deliver,
      heartbeat,
      maxConsecutiveFailures: 3,
      onUnexpectedFailure,
      shouldStop: () => stopped,
      wait,
    });

    expect(deliver).toHaveBeenCalledTimes(2);
    expect(heartbeat).toHaveBeenCalledOnce();
    expect(onUnexpectedFailure).toHaveBeenCalledWith(1);
    expect(wait).toHaveBeenCalledOnce();
  });

  test("resets the consecutive-failure count after successful delivery", async () => {
    let successfulDeliveries = 0;
    const deliver = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("first transient failure"))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("second transient failure"))
      .mockResolvedValueOnce();
    const onUnexpectedFailure = vi.fn();

    await runAuthzedCiOutboxWorker({
      deliver,
      heartbeat: async () => {
        successfulDeliveries += 1;
      },
      maxConsecutiveFailures: 2,
      onUnexpectedFailure,
      shouldStop: () => successfulDeliveries === 2,
      wait: async () => undefined,
    });

    expect(onUnexpectedFailure.mock.calls).toEqual([[1], [1]]);
  });

  test("stops after the bounded consecutive-failure limit without exposing the cause", async () => {
    const onUnexpectedFailure = vi.fn();
    let terminalError: unknown;

    try {
      await runAuthzedCiOutboxWorker({
        deliver: async () => {
          throw new Error("sensitive transport detail");
        },
        heartbeat: async () => undefined,
        maxConsecutiveFailures: 3,
        onUnexpectedFailure,
        shouldStop: () => false,
        wait: async () => undefined,
      });
    } catch (error) {
      terminalError = error;
    }

    expect(terminalError).toBeInstanceOf(Error);
    expect((terminalError as Error).message).toBe(
      "AuthZed CI outbox delivery exceeded its consecutive-failure limit"
    );
    expect(onUnexpectedFailure.mock.calls).toEqual([[1], [2], [3]]);
  });
});
