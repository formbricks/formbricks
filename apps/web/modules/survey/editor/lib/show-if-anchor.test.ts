import { describe, expect, test } from "vitest";
import { SHOW_IF_ANCHOR_PROPS, findShowIfAnchor } from "./show-if-anchor";

/** A stand-in for a DOM element: `closest` answers with the given row for the marker's selector. */
const triggerIn = (row: Element | null) => ({
  closest: (selector: string) => (selector === `[${Object.keys(SHOW_IF_ANCHOR_PROPS)[0]}]` ? row : null),
});

describe("findShowIfAnchor", () => {
  test("a trigger inside a marked row anchors the popover to that row", () => {
    const row = { id: "row" } as unknown as Element;
    expect(findShowIfAnchor(triggerIn(row))).toBe(row);
  });

  test("a trigger in no marked row anchors it to itself", () => {
    const trigger = triggerIn(null);
    expect(findShowIfAnchor(trigger)).toBe(trigger);
  });
});
