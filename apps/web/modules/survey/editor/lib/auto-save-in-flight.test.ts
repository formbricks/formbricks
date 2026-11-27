import { describe, expect, test } from "vitest";
import { createAutoSaveInFlight } from "./auto-save-in-flight";

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Whether `promise` has settled once every microtask queued so far, and those they queue, has run. */
const isSettled = async (promise: Promise<unknown>) => {
  let settled = false;
  void promise.then(() => (settled = true));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return settled;
};

describe("createAutoSaveInFlight", () => {
  test("settles at once when no tick ever ran", async () => {
    expect(await isSettled(createAutoSaveInFlight().settled())).toBe(true);
  });

  test("waits for the tick in flight, then lets the save through", async () => {
    const inFlight = createAutoSaveInFlight();
    const tick = deferred();
    inFlight.track(tick.promise);

    const waiting = inFlight.settled();
    expect(await isSettled(waiting)).toBe(false);

    tick.resolve();
    expect(await isSettled(waiting)).toBe(true);
  });

  test("resolves, not rejects, when the tick fails: the save goes out regardless", async () => {
    const inFlight = createAutoSaveInFlight();
    const tick = deferred();
    inFlight.track(tick.promise);

    tick.reject(new Error("502"));

    await expect(inFlight.settled()).resolves.toBeUndefined();
  });

  test("keeps waiting for a slow tick after a later tick skipped and resolved at once", async () => {
    // The request outlives the 10 s interval; the next tick sees one in flight and returns straight away.
    const inFlight = createAutoSaveInFlight();
    const slow = deferred();
    inFlight.track(slow.promise);
    inFlight.track(Promise.resolve());

    expect(await isSettled(inFlight.settled())).toBe(false);
    slow.resolve();
    expect(await isSettled(inFlight.settled())).toBe(true);
  });

  test("waits for a later tick too", async () => {
    const inFlight = createAutoSaveInFlight();
    const first = deferred();
    const second = deferred();
    inFlight.track(first.promise);
    first.resolve();
    inFlight.track(second.promise);

    expect(await isSettled(inFlight.settled())).toBe(false);
    second.resolve();
    expect(await isSettled(inFlight.settled())).toBe(true);
  });
});
