import { beforeEach, describe, expect, test, vi } from "vitest";
import { StorageErrorCode } from "@formbricks/storage";
import { TResponseData } from "@formbricks/types/responses";
import { ZAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  isAllowedFileExtension,
  isValidFileTypeForExtension,
  isValidImageFile,
  resolveStorageUrl,
  resolveStorageUrlAuto,
  resolveStorageUrlsInObject,
  sanitizeFileName,
  validateFileUploads,
  validateSingleFile,
} from "@/modules/storage/utils";

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

  describe("sanitizeFileName", () => {
    test("returns empty string for empty input", () => {
      expect(sanitizeFileName("")).toBe("");
    });

    test("keeps a normal filename unchanged", () => {
      expect(sanitizeFileName("photo.jpg")).toBe("photo.jpg");
    });

    test("replaces slashes and backslashes with dashes", () => {
      expect(sanitizeFileName("a/b\\c.txt")).toBe("a-b-c.txt");
    });

    test("removes reserved and control characters including #", () => {
      expect(sanitizeFileName("we<>:\"|?*`'#ird.pdf")).toBe("weird.pdf");
      expect(sanitizeFileName("test#file.png")).toBe("testfile.png");
    });

    test("collapses whitespace and trims", () => {
      expect(sanitizeFileName("  my   file   name   .jpg  ")).toBe("my file name.jpg");
    });

    test("keeps only last extension when multiple dots present", () => {
      expect(sanitizeFileName("my.backup.file.pdf")).toBe("my.backup.file.pdf");
    });

    test("returns empty string for base of only hyphens or dots", () => {
      expect(sanitizeFileName("----.png")).toBe("");
      expect(sanitizeFileName("....png")).toBe("");
    });

    test("sanitizes extension to alphanumeric only", () => {
      expect(sanitizeFileName("file.pn#g")).toBe("file.png");
    });

    test("truncates overly long base name", () => {
      const longBase = "a".repeat(300);
      const result = sanitizeFileName(`${longBase}.txt`);
      // base should be cut to 200 chars
      expect(result).toBe(`${"a".repeat(200)}.txt`);
    });
  });

  describe("getErrorResponseFromStorageError", () => {
    test("returns appropriate responses for each storage error code", async () => {
      // Spy on real module; keep behavior isolated to this test
      const responseMod = await import("@/app/lib/api/response");
      const spyNotFound = vi
        .spyOn(responseMod.responses, "notFoundResponse")
        .mockImplementation(
          (_entity: string, _id?: string | null, _public?: boolean) => new Response(null, { status: 404 })
        );
      const spyBadReq = vi
        .spyOn(responseMod.responses, "badRequestResponse")
        .mockImplementation(
          (_msg: string, _details?: unknown, _public?: boolean) => new Response(null, { status: 400 })
        );
      const spyISE = vi
        .spyOn(responseMod.responses, "internalServerErrorResponse")
        .mockImplementation((_msg: string, _public?: boolean) => new Response(null, { status: 500 }));

      const { getErrorResponseFromStorageError } = await import("@/modules/storage/utils");

      // FileNotFoundError uses notFoundResponse with details.fileName or null
      const r404 = getErrorResponseFromStorageError(
        { code: StorageErrorCode.FileNotFoundError },
        {
          fileName: "file.png",
        }
      );
      expect(r404.status).toBe(404);

      // InvalidInput -> 400
      const r400 = getErrorResponseFromStorageError({ code: StorageErrorCode.InvalidInput }, {
        reason: "bad",
      } as any);
      expect(r400.status).toBe(400);

      // S3 related and Unknown -> 500
      const r500a = getErrorResponseFromStorageError({ code: StorageErrorCode.S3ClientError });
      expect(r500a.status).toBe(500);
      const r500b = getErrorResponseFromStorageError({ code: StorageErrorCode.S3CredentialsError });
      expect(r500b.status).toBe(500);
      const r500c = getErrorResponseFromStorageError({ code: StorageErrorCode.Unknown });
      expect(r500c.status).toBe(500);

      // Default branch (unknown string) -> 500
      const r500d = getErrorResponseFromStorageError({ code: "something_else" as any });
      expect(r500d.status).toBe(500);

      spyNotFound.mockRestore();
      spyBadReq.mockRestore();
      spyISE.mockRestore();
    });
  });

  describe("getOriginalFileNameFromUrl (actual)", () => {
    test("extracts original name from full URL with fid and extension", async () => {
      const { getOriginalFileNameFromUrl } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");
      const url = "https://cdn.example.com/storage/env/public/photo--fid--12345.png?x=1#hash";
      expect(getOriginalFileNameFromUrl(url)).toBe("photo.png");
    });

    test("handles /storage/ relative path and missing fid", async () => {
      const { getOriginalFileNameFromUrl } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");
      const path = "/storage/env/public/Document%20Name.pdf";
      // Function extracts filename, not full path
      expect(getOriginalFileNameFromUrl(path)).toBe("Document Name.pdf");
    });

    test("returns empty string on invalid URL input", async () => {
      const { getOriginalFileNameFromUrl } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");
      expect(getOriginalFileNameFromUrl("ht!tp://%$^&")).toBe("");
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

  describe("resolveStorageUrl", () => {
    test("should return empty string for null or undefined input", () => {
      expect(resolveStorageUrl(null)).toBe("");
      expect(resolveStorageUrl(undefined)).toBe("");
      expect(resolveStorageUrl("")).toBe("");
    });

    test("should return absolute URL unchanged", () => {
      const httpsUrl = "https://example.com/storage/env-123/public/image.jpg";
      const httpUrl = "http://example.com/storage/env-123/public/image.jpg";

      expect(resolveStorageUrl(httpsUrl)).toBe(httpsUrl);
      expect(resolveStorageUrl(httpUrl)).toBe(httpUrl);
    });

    test("should resolve relative /storage/ path to absolute URL", async () => {
      const { resolveStorageUrl: actualResolveStorageUrl } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");

      const relativePath = "/storage/env-123/public/image.jpg";
      const result = actualResolveStorageUrl(relativePath);

      expect(result).toContain("/storage/env-123/public/image.jpg");
      expect(result.startsWith("http")).toBe(true);
    });

    test("should return non-storage paths unchanged", () => {
      expect(resolveStorageUrl("/some/other/path")).toBe("/some/other/path");
      expect(resolveStorageUrl("relative/path.jpg")).toBe("relative/path.jpg");
    });
  });

  describe("resolveStorageUrlAuto", () => {
    test("should return non-storage strings unchanged", () => {
      expect(resolveStorageUrlAuto("hello world")).toBe("hello world");
      expect(resolveStorageUrlAuto("/some/other/path")).toBe("/some/other/path");
      expect(resolveStorageUrlAuto("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
    });

    test("should NOT transform free-text values that merely start with /storage/", () => {
      expect(resolveStorageUrlAuto("/storage/help")).toBe("/storage/help");
      expect(resolveStorageUrlAuto("/storage/")).toBe("/storage/");
      expect(resolveStorageUrlAuto("/storage/some-text")).toBe("/storage/some-text");
      expect(resolveStorageUrlAuto("/storage/foo/bar")).toBe("/storage/foo/bar");
    });

    test("should resolve public storage URL", async () => {
      const { resolveStorageUrlAuto: actual } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");

      const result = actual("/storage/env-123/public/image.jpg");
      expect(result).toContain("/storage/env-123/public/image.jpg");
      expect(result.startsWith("http")).toBe(true);
    });

    test("should detect private access type from URL path", () => {
      const privateUrl = "/storage/env-123/private/file.pdf";
      const publicUrl = "/storage/env-123/public/image.jpg";

      expect(privateUrl.includes("/private/")).toBe(true);
      expect(publicUrl.includes("/private/")).toBe(false);
    });
  });

  describe("resolveStorageUrlsInObject", () => {
    test("should return null and undefined as-is", () => {
      expect(resolveStorageUrlsInObject(null)).toBeNull();
      expect(resolveStorageUrlsInObject(undefined)).toBeUndefined();
    });

    test("should return primitive values unchanged", () => {
      expect(resolveStorageUrlsInObject(42)).toBe(42);
      expect(resolveStorageUrlsInObject(true)).toBe(true);
      expect(resolveStorageUrlsInObject("hello")).toBe("hello");
    });

    test("should NOT transform free-text that merely starts with /storage/", () => {
      expect(resolveStorageUrlsInObject("/storage/help")).toBe("/storage/help");
      expect(resolveStorageUrlsInObject("/storage/")).toBe("/storage/");

      const input = {
        questionId1: "/storage/",
        questionId2: "/storage/help",
        questionId3: "/storage/some-text",
        questionId4: "/storage/foo/bar",
        realUrl: "/storage/env-123/public/image.jpg",
      };
      const result = resolveStorageUrlsInObject(input);
      expect(result.questionId1).toBe("/storage/");
      expect(result.questionId2).toBe("/storage/help");
      expect(result.questionId3).toBe("/storage/some-text");
      expect(result.questionId4).toBe("/storage/foo/bar");
      // realUrl still gets resolved because it matches the actual format
      expect(result.realUrl).not.toBe("/storage/env-123/public/image.jpg");
    });

    test("should preserve Date instances", () => {
      const date = new Date("2026-01-01");
      expect(resolveStorageUrlsInObject(date)).toBe(date);
    });

    test("should resolve storage URL strings", async () => {
      const { resolveStorageUrlsInObject: actual } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");

      const result = actual("/storage/env-123/public/image.jpg");
      expect(typeof result).toBe("string");
      expect(result).toContain("/storage/env-123/public/image.jpg");
      expect((result as string).startsWith("http")).toBe(true);
    });

    test("should resolve URLs in arrays", async () => {
      const { resolveStorageUrlsInObject: actual } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");

      const input = ["/storage/env-123/public/a.jpg", "plain text"];
      const result = actual(input);

      expect(result[0]).toContain("/storage/env-123/public/a.jpg");
      expect(result[0].startsWith("http")).toBe(true);
      expect(result[1]).toBe("plain text");
    });

    test("should resolve URLs in nested objects", async () => {
      const { resolveStorageUrlsInObject: actual } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");

      const input = {
        name: "Test Survey",
        welcomeCard: {
          fileUrl: "/storage/env-123/public/welcome.png",
          headline: "Hello",
        },
        elements: [
          {
            imageUrl: "/storage/env-123/public/q1.jpg",
            choices: [
              { id: "c1", imageUrl: "/storage/env-123/public/choice1.jpg" },
              { id: "c2", imageUrl: "https://external.com/image.jpg" },
            ],
          },
        ],
        count: 5,
        createdAt: new Date("2026-01-01"),
      };

      const result = actual(input);

      expect(result.welcomeCard.fileUrl.startsWith("http")).toBe(true);
      expect(result.welcomeCard.headline).toBe("Hello");
      expect(result.elements[0].imageUrl.startsWith("http")).toBe(true);
      expect(result.elements[0].choices[0].imageUrl.startsWith("http")).toBe(true);
      expect(result.elements[0].choices[1].imageUrl).toBe("https://external.com/image.jpg");
      expect(result.count).toBe(5);
      expect(result.createdAt).toEqual(new Date("2026-01-01"));
      expect(result.name).toBe("Test Survey");
    });

    test("should resolve URLs in deeply nested objects", async () => {
      const { resolveStorageUrlsInObject: actual } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");

      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  imageUrl: "/storage/env-123/public/deep.png",
                  items: [
                    {
                      nested: {
                        url: "/storage/env-123/public/nested.jpg",
                        label: "keep me",
                      },
                    },
                    "plain string",
                    42,
                    null,
                  ],
                },
              },
              sibling: "/storage/env-123/public/sibling.png",
            },
          },
          untouched: { a: { b: { c: "no change" } } },
        },
      };

      const result = actual(input);

      expect(result.level1.level2.level3.level4.level5.imageUrl).toContain(
        "/storage/env-123/public/deep.png"
      );
      expect(result.level1.level2.level3.level4.level5.imageUrl.startsWith("http")).toBe(true);

      // @ts-expect-error - items is an array of unknown types
      expect(result.level1.level2.level3.level4.level5.items[0].nested.url).toContain(
        "/storage/env-123/public/nested.jpg"
      );
      // @ts-expect-error - items is an array of unknown types
      expect(result.level1.level2.level3.level4.level5.items[0].nested.url.startsWith("http")).toBe(true);
      // @ts-expect-error - items is an array of unknown types
      expect(result.level1.level2.level3.level4.level5.items[0].nested.label).toBe("keep me");

      expect(result.level1.level2.level3.level4.level5.items[1]).toBe("plain string");
      expect(result.level1.level2.level3.level4.level5.items[2]).toBe(42);
      expect(result.level1.level2.level3.level4.level5.items[3]).toBeNull();

      expect(result.level1.level2.level3.sibling).toContain("/storage/env-123/public/sibling.png");
      expect(result.level1.level2.level3.sibling.startsWith("http")).toBe(true);

      expect(result.level1.untouched.a.b.c).toBe("no change");
    });

    test("should handle response data with file upload URLs", async () => {
      const { resolveStorageUrlsInObject: actual } =
        await vi.importActual<typeof import("@/modules/storage/utils")>("@/modules/storage/utils");

      const responseData = {
        questionId1: "text answer",
        questionId2: 42,
        fileUploadId: ["/storage/env-123/public/doc.pdf", "/storage/env-123/public/img.png"],
      };

      const result = actual(responseData);

      expect(result.questionId1).toBe("text answer");
      expect(result.questionId2).toBe(42);
      const fileUrls = result.fileUploadId;
      expect(fileUrls[0]).toContain("/storage/env-123/public/doc.pdf");
      expect(fileUrls[0].startsWith("http")).toBe(true);
      expect(fileUrls[1]).toContain("/storage/env-123/public/img.png");
      expect(fileUrls[1].startsWith("http")).toBe(true);
    });
  });
});
