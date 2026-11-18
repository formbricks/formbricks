import { describe, expect, test, vi } from "vitest";
import { focusOnOpen } from "./focus-on-open";

const openEvent = () => new Event("focusScope.autoFocusOnMount", { cancelable: true });

describe("focusOnOpen", () => {
  test("focuses the target instead of the first focusable element", () => {
    const target = { focus: vi.fn() } as unknown as HTMLElement;
    const event = openEvent();

    focusOnOpen(event, target);

    expect(target.focus).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  test("leaves the default focus alone when there is no target", () => {
    const event = openEvent();

    focusOnOpen(event, null);

    expect(event.defaultPrevented).toBe(false);
  });
});
