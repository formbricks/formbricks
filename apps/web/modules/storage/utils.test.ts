import {
  isAllowedFileExtension,
  isValidFileTypeForExtension,
  isValidImageFile,
  validateFileUploads,
  validateSingleFile,
} from "@/modules/storage/utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TResponseData } from "@formbricks/types/responses";
import { ZAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";

// Mock the getOriginalFileNameFromUrl function
const mockGetOriginalFileNameFromUrl = vi.hoisted(() => vi.fn());

vi.mock("@/modules/storage/utils", async () => {
  const actual = await vi.importActual("@/modules/storage/utils");
  return {
    ...actual,
    getOriginalFileNameFromUrl: mockGetOriginalFileNameFromUrl,
  };
});

describe("storage utils", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default: derive filename from URL path for positive-path tests
    mockGetOriginalFileNameFromUrl.mockImplementation((url: string) => {
      try {
        return new URL(url).pathname.split("/").filter(Boolean).pop();
      } catch {
        return undefined;
      }
    });
  });

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

  describe("validateSingleFile", () => {
    test("should return true for allowed file extension", () => {
      mockGetOriginalFileNameFromUrl.mockReturnValueOnce("image.jpg");
      expect(validateSingleFile("https://example.com/image.jpg", ["jpg", "png"])).toBe(true);
    });

    test("should return false for disallowed file extension", () => {
      mockGetOriginalFileNameFromUrl.mockReturnValueOnce("malicious.exe");
      expect(validateSingleFile("https://example.com/malicious.exe", ["jpg", "png"])).toBe(false);
    });

    test("should return true when no allowed extensions are specified", () => {
      mockGetOriginalFileNameFromUrl.mockReturnValueOnce("image.jpg");
      expect(validateSingleFile("https://example.com/image.jpg")).toBe(true);
    });

    test("should return false when file has no extension", () => {
      mockGetOriginalFileNameFromUrl.mockReturnValueOnce("filewithoutextension");
      expect(validateSingleFile("https://example.com/filewithoutextension", ["jpg"])).toBe(false);
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
      mockGetOriginalFileNameFromUrl.mockImplementationOnce(() => undefined);

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
      mockGetOriginalFileNameFromUrl.mockImplementationOnce(() => "file-without-extension");

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
      mockGetOriginalFileNameFromUrl.mockImplementationOnce(() => undefined);
      expect(isValidImageFile("https://example.com/invalid-url")).toBe(false);
    });

    test("should return false when file has no extension", () => {
      mockGetOriginalFileNameFromUrl.mockImplementationOnce(() => "image-without-extension");
      expect(isValidImageFile("https://example.com/image-without-extension")).toBe(false);
    });

    test("should return false when file name ends with a dot", () => {
      mockGetOriginalFileNameFromUrl.mockImplementationOnce(() => "image.");
      expect(isValidImageFile("https://example.com/image.")).toBe(false);
    });

    test("should handle case insensitivity correctly", () => {
      mockGetOriginalFileNameFromUrl.mockImplementationOnce(() => "image.JPG");
      expect(isValidImageFile("https://example.com/image.JPG")).toBe(true);
    });
  });
});
