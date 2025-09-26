import { describe, expect, test } from "vitest";
import { DEFAULT_LANGUAGE } from "./shared";

describe("lingodotdev shared", () => {
  test("should have DEFAULT_LANGUAGE", () => {
    expect(DEFAULT_LANGUAGE).toBe("en-US");
  });
});
