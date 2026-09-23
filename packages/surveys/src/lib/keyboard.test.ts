import { describe, expect, test } from "vitest";
import { isPlainEscape } from "./keyboard";

const key = (overrides: Partial<Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">>) => ({
  key: "Escape",
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...overrides,
});

describe("isPlainEscape", () => {
  test("accepts a bare Escape", () => {
    expect(isPlainEscape(key({}))).toBe(true);
  });

  test("rejects Escape combined with Alt, Ctrl or Meta", () => {
    expect(isPlainEscape(key({ altKey: true }))).toBe(false);
    expect(isPlainEscape(key({ ctrlKey: true }))).toBe(false);
    expect(isPlainEscape(key({ metaKey: true }))).toBe(false);
  });

  test("rejects other keys", () => {
    expect(isPlainEscape(key({ key: "Enter" }))).toBe(false);
    expect(isPlainEscape(key({ key: "Esc" }))).toBe(false);
  });
});
