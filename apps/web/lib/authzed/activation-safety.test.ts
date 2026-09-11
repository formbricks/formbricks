import { afterEach, describe, expect, test, vi } from "vitest";
import {
  runAuthzedActivationWithTimeout,
  runWithRenewingAuthzedPreparationLease,
  throwIfAuthzedActivationAborted,
} from "./activation-safety";

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe("AuthZed activation safety", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("aborts a timed-out operation and waits for its cleanup before rejecting", async () => {
    vi.useFakeTimers();
    const cleanup = deferred<void>();
    const operationSettled = vi.fn();
    const operation = vi.fn(async (signal: AbortSignal) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      await cleanup.promise;
      operationSettled();
      throwIfAuthzedActivationAborted(signal);
      return "unreachable";
    });

    const result = runAuthzedActivationWithTimeout(operation, 100);
    let callerSettled = false;
    void result.catch(() => {
      callerSettled = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(operation).toHaveBeenCalledOnce();
    expect(callerSettled).toBe(false);
    expect(operationSettled).not.toHaveBeenCalled();

    cleanup.resolve();
    await expect(result).rejects.toMatchObject({
      code: "authzed_activation_required",
      operation: "activation_timeout",
    });
    expect(operationSettled).toHaveBeenCalledOnce();
  });

  test("renews a preparation lease while work remains active and stops before returning", async () => {
    vi.useFakeTimers();
    const work = deferred<string>();
    const renewLease = vi.fn(async () => undefined);
    const result = runWithRenewingAuthzedPreparationLease(async () => work.promise, renewLease, 100);

    await vi.advanceTimersByTimeAsync(300);
    expect(renewLease).toHaveBeenCalledTimes(3);

    work.resolve("prepared");
    await expect(result).resolves.toBe("prepared");
    await vi.advanceTimersByTimeAsync(300);
    expect(renewLease).toHaveBeenCalledTimes(3);
  });

  test("aborts preparation and waits for cleanup when lease renewal fails", async () => {
    vi.useFakeTimers();
    const cleanup = deferred<void>();
    const renewalError = new Error("lease_lost");
    const renewLease = vi.fn(async () => {
      throw renewalError;
    });
    const operationSettled = vi.fn();
    const result = runWithRenewingAuthzedPreparationLease(
      async (signal) => {
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true })
        );
        await cleanup.promise;
        operationSettled();
        throwIfAuthzedActivationAborted(signal);
      },
      renewLease,
      100
    );
    let callerSettled = false;
    void result.catch(() => {
      callerSettled = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(callerSettled).toBe(false);
    expect(operationSettled).not.toHaveBeenCalled();

    cleanup.resolve();
    await expect(result).rejects.toBe(renewalError);
    expect(operationSettled).toHaveBeenCalledOnce();
  });
});
