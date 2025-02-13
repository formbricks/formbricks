import { describe, expect, test } from "vitest";
import { hashApiKey } from "../utils";

describe("hashApiKey", () => {
  test("generate the correct sha256 hash for a given input", () => {
    const input = "test";
    const expectedHash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const result = hashApiKey(input);
    expect(result).toEqual(expectedHash);
  });

  test("return a string with length 64", () => {
    const input = "another-api-key";
    const result = hashApiKey(input);
    expect(result).toHaveLength(64);
  });

  test("produce the same hash for identical inputs", () => {
    const input = "consistentKey";
    const firstHash = hashApiKey(input);
    const secondHash = hashApiKey(input);
    expect(firstHash).toEqual(secondHash);
  });

  test("generate different hashes for different inputs", () => {
    const hash1 = hashApiKey("key1");
    const hash2 = hashApiKey("key2");
    expect(hash1).not.toEqual(hash2);
  });
});
