import { describe, expect, test } from "vitest";
import { EDIT_HOTKEY, isEditHotkey } from "./edit-hotkey";

const bareEvent = (overrides: Record<string, unknown> = {}) =>
  ({
    key: EDIT_HOTKEY,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    ...overrides,
  }) as Parameters<typeof isEditHotkey>[0];

describe("isEditHotkey", () => {
  test("matches a bare e", () => {
    expect(isEditHotkey(bareEvent())).toBe(true);
  });

  test("matches an upper case E typed with caps lock", () => {
    expect(isEditHotkey(bareEvent({ key: "E" }))).toBe(true);
  });

  test("ignores another key", () => {
    expect(isEditHotkey(bareEvent({ key: "r" }))).toBe(false);
  });

  test.each(["metaKey", "ctrlKey", "altKey", "shiftKey"])("ignores e with %s held", (modifier) => {
    expect(isEditHotkey(bareEvent({ [modifier]: true }))).toBe(false);
  });

  test("ignores a keystroke composing an IME character", () => {
    expect(isEditHotkey(bareEvent({ isComposing: true }))).toBe(false);
  });

  test.each(["INPUT", "TEXTAREA", "SELECT"])("leaves the keystroke to a focused %s", (tagName) => {
    expect(isEditHotkey(bareEvent({ target: { tagName } }))).toBe(false);
  });

  test("leaves the keystroke to a contenteditable element", () => {
    expect(isEditHotkey(bareEvent({ target: { tagName: "DIV", isContentEditable: true } }))).toBe(false);
  });

  test("fires when the focused element does not take text", () => {
    expect(isEditHotkey(bareEvent({ target: { tagName: "BUTTON", isContentEditable: false } }))).toBe(true);
  });
});
