import { describe, expect, test } from "vitest";
import { ZAllowedFileExtension } from "@formbricks/types/common";
import { isAllowedFileExtension, isValidFileTypeForExtension, validateFile } from "./fileValidation";

describe("fileValidation", () => {
  describe("isAllowedFileExtension", () => {
    test("should return false for a file with no extension", () => {
      expect(isAllowedFileExtension("filename")).toBe(false);
    });

    test("should return false for a file with extension not in allowed list", () => {
      expect(isAllowedFileExtension("malicious.exe")).toBe(false);
      expect(isAllowedFileExtension("script.php")).toBe(false);
      expect(isAllowedFileExtension("config.js")).toBe(false);
      expect(isAllowedFileExtension("page.html")).toBe(false);
    });

    test("should return true for an allowed file extension", () => {
      Object.values(ZAllowedFileExtension.enum).forEach((ext) => {
        expect(isAllowedFileExtension(`file.${ext}`)).toBe(true);
      });
    });

    test("should handle case insensitivity correctly", () => {
      expect(isAllowedFileExtension("image.PNG")).toBe(true);
      expect(isAllowedFileExtension("document.PDF")).toBe(true);
    });

    test("should handle filenames with multiple dots", () => {
      expect(isAllowedFileExtension("example.backup.pdf")).toBe(true);
      expect(isAllowedFileExtension("document.old.exe")).toBe(false);
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
  });

  describe("validateFile", () => {
    test("should return valid: false when file extension is not allowed", () => {
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

    test("should return valid: true for allowed file types", () => {
      Object.values(ZAllowedFileExtension.enum).forEach((ext) => {
        // Skip testing extensions that don't have defined MIME types in the test
        if (["jpg", "png", "pdf"].includes(ext)) {
          const mimeType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "application/pdf";
          const result = validateFile(`file.${ext}`, mimeType);
          expect(result.valid).toBe(true);
        }
      });
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
});
