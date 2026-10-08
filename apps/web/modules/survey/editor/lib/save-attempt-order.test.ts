import { describe, expect, test } from "vitest";
import { createSaveAttemptOrder } from "./save-attempt-order";

describe("createSaveAttemptOrder", () => {
  test("an attempt that settles alone is current", () => {
    const order = createSaveAttemptOrder();
    const attempt = order.begin();

    expect(order.settle(attempt)).toBe(true);
  });

  test("an older auto-save that settles after a newer save already settled is stale", () => {
    // Either way round: tick A in flight, a manual save of B starts and settles first, then A settles.
    // If B failed, A landing must not say "Progress saved"; if B landed, A failing must not say
    // "Changes not saved". The order alone decides it, not whether either one succeeded.
    const order = createSaveAttemptOrder();
    const autoSave = order.begin();
    const manualSave = order.begin();

    expect(order.settle(manualSave)).toBe(true);
    expect(order.settle(autoSave)).toBe(false);
  });

  test("attempts that settle in the order they started are all current", () => {
    const order = createSaveAttemptOrder();
    const first = order.begin();
    const second = order.begin();

    expect(order.settle(first)).toBe(true);
    expect(order.settle(second)).toBe(true);
  });

  test("a newer attempt is current even after an older one was rejected as stale", () => {
    const order = createSaveAttemptOrder();
    const first = order.begin();
    const second = order.begin();
    order.settle(second);
    order.settle(first);
    const third = order.begin();

    expect(order.settle(third)).toBe(true);
  });

  test("each editor gets its own ordering", () => {
    const one = createSaveAttemptOrder();
    const other = createSaveAttemptOrder();
    one.settle(one.begin());
    one.settle(one.begin());

    expect(other.settle(other.begin())).toBe(true);
  });
});
