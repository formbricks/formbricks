import { beforeEach, describe, expect, test, vi } from "vitest";
import { isValidCssSelector } from "./actionClass";

describe("isValidCssSelector", () => {
  beforeEach(() => {
    // Mock document.createElement and querySelector
    const mockElement = {
      querySelector: vi.fn(),
    };
    global.document = {
      createElement: vi.fn(() => mockElement),
    } as any;
  });

  test("should return false for undefined selector", () => {
    expect(isValidCssSelector(undefined)).toBe(false);
  });

  test("should return false for empty string", () => {
    expect(isValidCssSelector("")).toBe(false);
  });

  test("should return true for valid CSS selector", () => {
    const mockElement = {
      querySelector: vi.fn(),
    };
    (document.createElement as any).mockReturnValue(mockElement);
    expect(isValidCssSelector(".class")).toBe(true);
    expect(isValidCssSelector("#id")).toBe(true);
    expect(isValidCssSelector("div")).toBe(true);
  });

  test("should return false for invalid CSS selector", () => {
    const mockElement = {
      querySelector: vi.fn(() => {
        throw new Error("Invalid selector");
      }),
    };
    (document.createElement as any).mockReturnValue(mockElement);
    expect(isValidCssSelector("..invalid")).toBe(false);
    expect(isValidCssSelector("##invalid")).toBe(false);
  });
});
