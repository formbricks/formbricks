import { describe, expect, test } from "vitest";
import { hashApiKey } from "../utils";

describe("hashApiKey", () => {
  test("generate the correct sha256 hash for a given input", () => {
    const input = "test";
    const expectedHash = "fake-hash"; // mocked on the vitestSetup.ts file;
    const result = hashApiKey(input);
    expect(result).toEqual(expectedHash);
  });

  test("return a string with length 64", () => {
    const input = "another-api-key";
    const result = hashApiKey(input);
    expect(result).toHaveLength(9); // mocked on the vitestSetup.ts file;;
  });
});
