import { afterEach, describe, expect, test, vi } from "vitest";
import { TimeoutStack } from "@/lib/common/timeout-stack";

// Using vitest, we don't need to manually declare globals

describe("TimeoutStack", () => {
  // Clear the singleton's state after each test to avoid cross-test contamination
  afterEach(() => {
    const instance = TimeoutStack.getInstance();
    instance.clear();
  });

  test("should return the same instance (singleton pattern)", () => {
    const instance1 = TimeoutStack.getInstance();
    const instance2 = TimeoutStack.getInstance();
    expect(instance1).toBe(instance2);
  });

  test("should add a timeout and retrieve it", () => {
    const instance = TimeoutStack.getInstance();
    instance.add("testEvent", 123);
    const timeouts = instance.getTimeouts();
    expect(timeouts).toEqual([{ event: "testEvent", timeoutId: 123 }]);
  });

  test("should remove a timeout and call clearTimeout", () => {
    vi.useFakeTimers();
    const instance = TimeoutStack.getInstance();
    instance.add("testEvent", 456);
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    instance.remove(456);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(456);
    expect(instance.getTimeouts()).toEqual([]);
    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  test("should clear all timeouts and call clearTimeout for each", () => {
    vi.useFakeTimers();
    const instance = TimeoutStack.getInstance();
    instance.add("event1", 100);
    instance.add("event2", 200);
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    instance.clear();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(100);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(200);
    expect(instance.getTimeouts()).toEqual([]);
    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});
