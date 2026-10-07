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
    expect(timeouts).toEqual([{ event: "testEvent", timeoutId: 123, fired: false }]);
  });

  test("markFired flips only the entry with the given id", () => {
    const instance = TimeoutStack.getInstance();
    instance.add("eventA", 111);
    instance.add("eventB", 222);

    instance.markFired(111);

    expect(instance.getTimeouts()).toEqual([
      { event: "eventA", timeoutId: 111, fired: true },
      { event: "eventB", timeoutId: 222, fired: false },
    ]);
  });

  test("markFired ignores an id that is not on the stack", () => {
    const instance = TimeoutStack.getInstance();
    instance.add("eventA", 111);

    expect(() => {
      instance.markFired(999);
    }).not.toThrow();
    expect(instance.getTimeouts()).toEqual([{ event: "eventA", timeoutId: 111, fired: false }]);
  });

  test("add drops the same action's spent entry, but keeps another action's", () => {
    const instance = TimeoutStack.getInstance();
    instance.add("pageView", 111);
    instance.markFired(111);
    instance.add("otherAction", 222);
    instance.markFired(222);

    // Re-scheduling "pageView" retires only its own spent entry — otherwise the stack grows by one
    // entry per survey ever rendered, and the by-name lookup has several entries to choose from.
    instance.add("pageView", 333);

    expect(instance.getTimeouts()).toEqual([
      { event: "otherAction", timeoutId: 222, fired: true },
      { event: "pageView", timeoutId: 333, fired: false },
    ]);
  });

  test("add retires an entry whose timeout id a new timer reuses", () => {
    const instance = TimeoutStack.getInstance();
    instance.add("firstAction", 5);
    instance.markFired(5);

    // A browser may hand id 5 to a later timer once the first one has run. Both lookups on this
    // stack resolve by id, so the spent entry has to go or markFired below marks it instead.
    instance.add("secondAction", 5);
    instance.markFired(5);

    expect(instance.getTimeouts()).toEqual([{ event: "secondAction", timeoutId: 5, fired: true }]);
  });

  test("add keeps a still-pending entry for the same action", () => {
    const instance = TimeoutStack.getInstance();
    instance.add("pageView", 111);
    instance.add("pageView", 222);

    expect(instance.getTimeouts()).toEqual([
      { event: "pageView", timeoutId: 111, fired: false },
      { event: "pageView", timeoutId: 222, fired: false },
    ]);
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
