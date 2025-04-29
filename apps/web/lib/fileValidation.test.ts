import { describe, expect, test } from "vitest";
import {
  BLOCKED_FILE_EXTENSIONS,
  isAllowedFileExtension,
  isValidFileTypeForExtension,
  validateFile,
} from "./fileValidation";

describe("fileValidation", () => {
  describe("isAllowedFileExtension", () => {
    test("should return false for a file with no extension", () => {
      expect(isAllowedFileExtension("filename")).toBe(false);
    });

    test("should return false for a blocked file extension", () => {
      expect(isAllowedFileExtension("malicious.exe")).toBe(false);
      expect(isAllowedFileExtension("script.php")).toBe(false);
      expect(isAllowedFileExtension("config.js")).toBe(false);
      expect(isAllowedFileExtension("page.html")).toBe(false);
    });

    test("should return true for an allowed file extension", () => {
      expect(isAllowedFileExtension("image.png")).toBe(true);
      expect(isAllowedFileExtension("document.pdf")).toBe(true);
      expect(isAllowedFileExtension("spreadsheet.xlsx")).toBe(true);
    });

    test("should handle case insensitivity correctly", () => {
      expect(isAllowedFileExtension("malicious.EXE")).toBe(false);
      expect(isAllowedFileExtension("image.PNG")).toBe(true);
    });

    test("should handle filenames with multiple dots", () => {
      expect(isAllowedFileExtension("example.config.js")).toBe(false);
      expect(isAllowedFileExtension("document.backup.pdf")).toBe(true);
    });
  });

  describe("isValidFileTypeForExtension", () => {
    test("should return false for a file with no extension", () => {
      expect(isValidFileTypeForExtension("filename", "application/octet-stream")).toBe(false);
    });

    test("should return true for valid extension and MIME type combinations", () => {
      expect(isValidFileTypeForExtension("image.jpg", "image/jpeg")).toBe(true);
      expect(isValidFileTypeForExtension("image.png", "image/png")).toBe(true);
      expect(isValidFileTypeForExtension("document.pdf", "application/pdf")).toBe(true);
    });

    test("should return false for mismatched extension and MIME type", () => {
      expect(isValidFileTypeForExtension("image.jpg", "image/png")).toBe(false);
      expect(isValidFileTypeForExtension("document.pdf", "image/jpeg")).toBe(false);
      expect(isValidFileTypeForExtension("image.png", "application/pdf")).toBe(false);
    });

    test("should handle case insensitivity correctly", () => {
      expect(isValidFileTypeForExtension("image.JPG", "image/jpeg")).toBe(true);
      expect(isValidFileTypeForExtension("image.jpg", "IMAGE/JPEG")).toBe(true);
    });

    test("should return true for unknown extensions", () => {
      expect(isValidFileTypeForExtension("data.xyz", "application/octet-stream")).toBe(true);
    });
  });

  describe("validateFile", () => {
    test("should return valid: false when file extension is blocked", () => {
      const result = validateFile("script.php", "application/php");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File type not allowed");
    });

    test("should return valid: false when file type does not match extension", () => {
      const result = validateFile("image.png", "application/pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File type doesn't match");
    });

    test("should return valid: true when file is allowed and type matches extension", () => {
      const result = validateFile("image.jpg", "image/jpeg");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should return valid: true for unknown file types that are not blocked", () => {
      const result = validateFile("data.custom", "application/octet-stream");
      expect(result.valid).toBe(true);
    });

    test("should return valid: false for files with no extension", () => {
      const result = validateFile("noextension", "application/octet-stream");
      expect(result.valid).toBe(false);
    });

    test("should handle attempts to bypass with double extension", () => {
      const result = validateFile("malicious.jpg.php", "image/jpeg");
      expect(result.valid).toBe(false);
    });
  });

  describe("BLOCKED_FILE_EXTENSIONS", () => {
    test("should contain all expected blocked extensions", () => {
      const expectedDangerousExtensions = ["exe", "php", "js", "html", "bat"];
      for (const ext of expectedDangerousExtensions) {
        expect(BLOCKED_FILE_EXTENSIONS).toContain(ext);
      }
    });

    test("should be a non-empty array", () => {
      expect(Array.isArray(BLOCKED_FILE_EXTENSIONS)).toBe(true);
      expect(BLOCKED_FILE_EXTENSIONS.length).toBeGreaterThan(0);
    });
  });
});
