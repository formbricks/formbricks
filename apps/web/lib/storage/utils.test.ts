import { describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getFileNameWithIdFromUrl, getOriginalFileNameFromUrl } from "./utils";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("Storage Utils", () => {
  describe("getOriginalFileNameFromUrl", () => {
    test("should handle URL without file ID", () => {
      const url = "/storage/test-file.pdf";
      expect(getOriginalFileNameFromUrl(url)).toBe("test-file.pdf");
    });

    test("should handle invalid URL", () => {
      const url = "invalid-url";
      expect(getOriginalFileNameFromUrl(url)).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getFileNameWithIdFromUrl", () => {
    test("should get full filename with ID from storage URL", () => {
      const url = "/storage/test-file.pdf--fid--123";
      expect(getFileNameWithIdFromUrl(url)).toBe("test-file.pdf--fid--123");
    });

    test("should get full filename with ID from external URL", () => {
      const url = "https://example.com/path/test-file.pdf--fid--123";
      expect(getFileNameWithIdFromUrl(url)).toBe("test-file.pdf--fid--123");
    });

    test("should handle invalid URL", () => {
      const url = "invalid-url";
      expect(getFileNameWithIdFromUrl(url)).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
