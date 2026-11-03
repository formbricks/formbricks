import { afterEach, describe, expect, test, vi } from "vitest";
import { withRedisDeadline } from "./deadline";

afterEach(() => {
  vi.useRealTimers();
});

describe("withRedisDeadline", () => {
  test("removes its timer when the operation succeeds or fails", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    await expect(withRedisDeadline(Promise.resolve("ok"), 500, onTimeout)).resolves.toBe("ok");
    await expect(withRedisDeadline(Promise.reject(new Error("failed")), 500, onTimeout)).rejects.toThrow(
      "failed"
    );

    expect(vi.getTimerCount()).toBe(0);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  test("rejects at the deadline and invokes cleanup once", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const operation = new Promise<string>(() => {});
    const result = withRedisDeadline(operation, 500, onTimeout);
    const assertion = expect(result).rejects.toThrow("Redis operation timed out");

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
