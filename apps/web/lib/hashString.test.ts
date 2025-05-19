import { describe, expect, test } from "vitest";
import { hashString } from "./hashString";

describe("hashString", () => {
  test("should return a string", () => {
    const input = "test string";
    const hash = hashString(input);

    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  test("should produce consistent hashes for the same input", () => {
    const input = "test string";
    const hash1 = hashString(input);
    const hash2 = hashString(input);

    expect(hash1).toBe(hash2);
  });

  test("should handle empty strings", () => {
    const hash = hashString("");

    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  test("should handle special characters", () => {
    const input = "!@#$%^&*()_+{}|:<>?";
    const hash = hashString(input);

    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  test("should handle unicode characters", () => {
    const input = "Hello, 世界!";
    const hash = hashString(input);

    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  test("should handle long strings", () => {
    const input = "a".repeat(1000);
    const hash = hashString(input);

    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});
