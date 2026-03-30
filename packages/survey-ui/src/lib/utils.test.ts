import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  test("merges class names correctly", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("handles conditional classes", () => {
    const condition = false;
    expect(cn("foo", condition && "bar", "baz")).toBe("foo baz");
  });

  test("handles undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  test("merges Tailwind classes and resolves conflicts", () => {
    // tailwind-merge should resolve conflicting classes
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  test("handles empty input", () => {
    expect(cn()).toBe("");
  });

  test("handles arrays of classes", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  test("handles objects with conditional classes", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  test("handles mixed inputs", () => {
    expect(cn("foo", ["bar", "baz"], { qux: true })).toBe("foo bar baz qux");
  });

  test("handles custom Tailwind tokens", () => {
    // Test that custom tokens work with the extended tailwind-merge
    const result = cn("text-input", "text-button");
    expect(result).toContain("text-button");
  });
});
