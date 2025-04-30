import * as storageUtils from "@/lib/storage/utils";
import { describe, expect, test, vi } from "vitest";
import { ZAllowedFileExtension } from "@formbricks/types/common";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  isAllowedFileExtension,
  isValidFileTypeForExtension,
  isValidImageFile,
  validateFile,
  validateFileUploads,
} from "./fileValidation";

// Mock getOriginalFileNameFromUrl function
vi.mock("@/lib/storage/utils", () => ({
  getOriginalFileNameFromUrl: vi.fn((url) => {
    // Extract filename from the URL for testing purposes
    const parts = url.split("/");
    return parts[parts.length - 1];
  }),
}));

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

  describe("validateFileUploads", () => {
    test("should return true for valid file uploads in response data", () => {
      const responseData = {
        question1: ["https://example.com/storage/file1.jpg", "https://example.com/storage/file2.pdf"],
      };

      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["jpg", "pdf"],
        } as TSurveyQuestion,
      ];

      expect(validateFileUploads(responseData, questions)).toBe(true);
    });

    test("should return false when file url is not a string", () => {
      const responseData = {
        question1: [123, "https://example.com/storage/file.jpg"],
      } as TResponseData;

      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["jpg"],
        } as TSurveyQuestion,
      ];

      expect(validateFileUploads(responseData, questions)).toBe(false);
    });

    test("should return false when file urls are not in an array", () => {
      const responseData = {
        question1: "https://example.com/storage/file.jpg",
      };

      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["jpg"],
        } as TSurveyQuestion,
      ];

      expect(validateFileUploads(responseData, questions)).toBe(false);
    });

    test("should return false when file extension is not allowed", () => {
      const responseData = {
        question1: ["https://example.com/storage/file.exe"],
      };

      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["jpg", "pdf"],
        } as TSurveyQuestion,
      ];

      expect(validateFileUploads(responseData, questions)).toBe(false);
    });

    test("should return false when file name cannot be extracted", () => {
      // Mock implementation to return null for this specific URL
      vi.mocked(storageUtils.getOriginalFileNameFromUrl).mockImplementationOnce(() => undefined);

      const responseData = {
        question1: ["https://example.com/invalid-url"],
      };

      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["jpg"],
        } as TSurveyQuestion,
      ];

      expect(validateFileUploads(responseData, questions)).toBe(false);
    });

    test("should return false when file has no extension", () => {
      vi.mocked(storageUtils.getOriginalFileNameFromUrl).mockImplementationOnce(
        () => "file-without-extension"
      );

      const responseData = {
        question1: ["https://example.com/storage/file-without-extension"],
      };

      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["jpg"],
        } as TSurveyQuestion,
      ];

      expect(validateFileUploads(responseData, questions)).toBe(false);
    });

    test("should ignore non-fileUpload questions", () => {
      const responseData = {
        question1: ["https://example.com/storage/file.jpg"],
        question2: "Some text answer",
      };

      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["jpg"],
        },
        {
          id: "question2",
          type: "text" as const,
        },
      ] as TSurveyQuestion[];

      expect(validateFileUploads(responseData, questions)).toBe(true);
    });

    test("should return true when no questions are provided", () => {
      const responseData = {
        question1: ["https://example.com/storage/file.jpg"],
      };

      expect(validateFileUploads(responseData)).toBe(true);
    });
  });

  describe("isValidImageFile", () => {
    test("should return true for valid image file extensions", () => {
      expect(isValidImageFile("https://example.com/image.jpg")).toBe(true);
      expect(isValidImageFile("https://example.com/image.jpeg")).toBe(true);
      expect(isValidImageFile("https://example.com/image.png")).toBe(true);
      expect(isValidImageFile("https://example.com/image.webp")).toBe(true);
      expect(isValidImageFile("https://example.com/image.heic")).toBe(true);
    });

    test("should return false for non-image file extensions", () => {
      expect(isValidImageFile("https://example.com/document.pdf")).toBe(false);
      expect(isValidImageFile("https://example.com/document.docx")).toBe(false);
      expect(isValidImageFile("https://example.com/document.txt")).toBe(false);
    });

    test("should return false when file name cannot be extracted", () => {
      vi.mocked(storageUtils.getOriginalFileNameFromUrl).mockImplementationOnce(() => undefined);
      expect(isValidImageFile("https://example.com/invalid-url")).toBe(false);
    });

    test("should return false when file has no extension", () => {
      vi.mocked(storageUtils.getOriginalFileNameFromUrl).mockImplementationOnce(
        () => "image-without-extension"
      );
      expect(isValidImageFile("https://example.com/image-without-extension")).toBe(false);
    });

    test("should return false when file name ends with a dot", () => {
      vi.mocked(storageUtils.getOriginalFileNameFromUrl).mockImplementationOnce(() => "image.");
      expect(isValidImageFile("https://example.com/image.")).toBe(false);
    });

    test("should handle case insensitivity correctly", () => {
      vi.mocked(storageUtils.getOriginalFileNameFromUrl).mockImplementationOnce(() => "image.JPG");
      expect(isValidImageFile("https://example.com/image.JPG")).toBe(true);
    });
  });
});
