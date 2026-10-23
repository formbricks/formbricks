/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test } from "vitest";
import { createFocusReturn } from "./focus-return";

const button = (label: string, parent: HTMLElement = document.body) => {
  const element = document.createElement("button");
  element.textContent = label;
  parent.appendChild(element);
  return element;
};

const setup = () => {
  const surface = document.createElement("div");
  document.body.appendChild(surface);
  const origin = button("origin");
  const close = button("close", surface);
  const focusReturn = createFocusReturn((element) => surface.contains(element));
  return { surface, origin, close, focusReturn };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("createFocusReturn", () => {
  test("hands focus back to where it came from when the surface is dismissed from inside", () => {
    const { origin, close, focusReturn } = setup();
    close.focus();
    focusReturn.recordEntry(origin);

    focusReturn.restore(document.activeElement);

    expect(document.activeElement).toBe(origin);
  });

  test("leaves focus alone when it is no longer in the surface (dismissed by mouse)", () => {
    const { origin, focusReturn } = setup();
    const elsewhere = button("elsewhere");
    focusReturn.recordEntry(origin);
    elsewhere.focus();

    focusReturn.restore(document.activeElement);

    expect(document.activeElement).toBe(elsewhere);
  });

  test("keeps the first origin when focus moves within the surface or into a remounted one", () => {
    const { surface, origin, close, focusReturn } = setup();
    focusReturn.recordEntry(origin);
    // A new failure remounts the notice and focuses its Close: the event comes from the old one.
    const remountedClose = button("close again", surface);
    remountedClose.focus();
    focusReturn.recordEntry(close);
    focusReturn.recordEntry(null);

    focusReturn.restore(document.activeElement);

    expect(document.activeElement).toBe(origin);
  });

  test("forgets the origin once used, so a later dismissal does not jump back to it", () => {
    const { origin, close, focusReturn } = setup();
    focusReturn.recordEntry(origin);
    close.focus();
    focusReturn.restore(document.activeElement);

    close.focus();
    focusReturn.restore(document.activeElement);

    expect(document.activeElement).toBe(close);
  });
});
