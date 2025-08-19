// apps/web/lib/utils/version.test.ts
import { describe, expect, test } from "vitest";
import { isNewerVersion, parseVersion } from "./utils";

describe("Version utilities", () => {
  describe("parseVersion", () => {
    test("should parse valid semantic versions", () => {
      expect(parseVersion("1.2.3")).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });

      expect(parseVersion("v2.0.0-beta.1")).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: "beta.1",
      });
    });

    test("should return null for invalid versions", () => {
      expect(parseVersion("invalid")).toBeNull();
      expect(parseVersion("1.2")).toEqual({
        major: 1,
        minor: 2,
        patch: 0,
      });
    });
  });

  describe("isNewerVersion", () => {
    test("should correctly identify newer versions", () => {
      expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
      expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
      expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);

      expect(isNewerVersion("1.0.1", "1.0.0")).toBe(false);
      expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    });

    test("should handle version prefixes", () => {
      expect(isNewerVersion("v1.0.0", "v1.0.1")).toBe(true);
      expect(isNewerVersion("1.0.0", "v1.0.1")).toBe(true);
    });

    test("should handle prerelease versions", () => {
      expect(isNewerVersion("1.0.0-beta.1", "1.0.0")).toBe(true);
      expect(isNewerVersion("1.0.0", "1.0.0-beta.1")).toBe(false);
    });

    test("should treat two-part versions as patch=0 (e.g., 3.16 == 3.16.0)", () => {
      expect(isNewerVersion("3.16", "3.16.0")).toBe(false);
      expect(isNewerVersion("3.16.0", "3.16")).toBe(false);
      expect(isNewerVersion("3.16", "3.16.1")).toBe(true);
    });

    test("should ignore build metadata for precedence", () => {
      expect(isNewerVersion("1.0.0+001", "1.0.0+002")).toBe(false);
      expect(isNewerVersion("1.0.0", "1.0.0+exp.sha.5114f85")).toBe(false);
      expect(isNewerVersion("1.0.0+build.1", "1.0.1+build.0")).toBe(true);
    });
  });
});
