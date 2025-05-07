import { describe, expect, test, vi } from "vitest";
import { delay, isFulfilled, isRejected } from "./promises";

describe("promises utilities", () => {
  test("delay resolves after specified time", async () => {
    const delayTime = 100;

    vi.useFakeTimers();
    const promise = delay(delayTime);

    vi.advanceTimersByTime(delayTime);
    await promise;

    vi.useRealTimers();
  });

  test("isFulfilled returns true for fulfilled promises", () => {
    const fulfilledResult: PromiseSettledResult<string> = {
      status: "fulfilled",
      value: "success",
    };

    expect(isFulfilled(fulfilledResult)).toBe(true);

    if (isFulfilled(fulfilledResult)) {
      expect(fulfilledResult.value).toBe("success");
    }
  });

  test("isFulfilled returns false for rejected promises", () => {
    const rejectedResult: PromiseSettledResult<string> = {
      status: "rejected",
      reason: "error",
    };

    expect(isFulfilled(rejectedResult)).toBe(false);
  });

  test("isRejected returns true for rejected promises", () => {
    const rejectedResult: PromiseSettledResult<string> = {
      status: "rejected",
      reason: "error",
    };

    expect(isRejected(rejectedResult)).toBe(true);

    if (isRejected(rejectedResult)) {
      expect(rejectedResult.reason).toBe("error");
    }
  });

  test("isRejected returns false for fulfilled promises", () => {
    const fulfilledResult: PromiseSettledResult<string> = {
      status: "fulfilled",
      value: "success",
    };

    expect(isRejected(fulfilledResult)).toBe(false);
  });

  test("delay can be used in actual timing scenarios", async () => {
    const mockCallback = vi.fn();

    setTimeout(mockCallback, 50);
    await delay(100);

    expect(mockCallback).toHaveBeenCalled();
  });

  test("type guard functions work correctly with Promise.allSettled", async () => {
    const promises = [Promise.resolve("success"), Promise.reject("failure")];

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter(isFulfilled);
    const rejected = results.filter(isRejected);

    expect(fulfilled.length).toBe(1);
    expect(fulfilled[0].value).toBe("success");

    expect(rejected.length).toBe(1);
    expect(rejected[0].reason).toBe("failure");
  });
});
