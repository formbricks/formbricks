// apps/web/lib/utils/version.test.ts
import { describe, expect, it } from "vitest";
import { isNewerVersion, parseVersion } from "./utils";

describe("Version utilities", () => {
  describe("parseVersion", () => {
    it("should parse valid semantic versions", () => {
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

    it("should return null for invalid versions", () => {
      expect(parseVersion("invalid")).toBeNull();
      expect(parseVersion("1.2")).toBeNull();
    });
  });

  describe("isNewerVersion", () => {
    it("should correctly identify newer versions", () => {
      expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
      expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
      expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);

      expect(isNewerVersion("1.0.1", "1.0.0")).toBe(false);
      expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    });

    it("should handle version prefixes", () => {
      expect(isNewerVersion("v1.0.0", "v1.0.1")).toBe(true);
      expect(isNewerVersion("1.0.0", "v1.0.1")).toBe(true);
    });

    it("should handle prerelease versions", () => {
      expect(isNewerVersion("1.0.0-beta.1", "1.0.0")).toBe(true);
      expect(isNewerVersion("1.0.0", "1.0.0-beta.1")).toBe(false);
    });
  });
});
