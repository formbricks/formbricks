import { beforeEach, describe, expect, onTestFinished, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { StorageErrorCode } from "@formbricks/storage";
import { TResponseData } from "@formbricks/types/responses";
import { ZAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  collectResponseFileUrls,
  getStorageUrlSurveyId,
  getSurveyFileUploadElementIds,
  isAllowedFileExtension,
  isValidImageFile,
  parseStorageFileUrl,
  resolveStorageUrl,
  resolveStorageUrlAuto,
  resolveStorageUrlsInObject,
  sanitizeFileName,
  validateClientFileUploads,
  validateSingleFile,
  validateSurveyAllowsFileUpload,
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
        .mockImplementation((msg: string, _public?: boolean, details = {}) =>
          Response.json({ code: "internal_server_error", message: msg, details }, { status: 500 })
        );

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
      await expect(r500a.json()).resolves.toMatchObject({
        message: "File storage is not configured correctly. Please check your file upload settings.",
        details: { storage_error_code: StorageErrorCode.S3ClientError },
      });
      const r500b = getErrorResponseFromStorageError({ code: StorageErrorCode.S3CredentialsError });
      expect(r500b.status).toBe(500);
      await expect(r500b.json()).resolves.toMatchObject({
        message: "File storage is not configured correctly. Please check your file upload settings.",
        details: { storage_error_code: StorageErrorCode.S3CredentialsError },
      });
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

  describe("validateSurveyAllowsFileUpload", () => {
    test("should allow a matching extension from a modern file upload block element", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "element1",
              type: "fileUpload" as const,
              allowedFileExtensions: ["pdf"],
            },
          ],
        },
      ] as unknown as TSurveyBlock[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "report.pdf", elementId: "element1", blocks })
      ).toEqual({
        ok: true,
      });
    });

    test("should allow a matching extension from a legacy file upload question", () => {
      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
          allowedFileExtensions: ["png"],
        },
      ] as TSurveyQuestion[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "image.png", elementId: "question1", questions })
      ).toEqual({ ok: true });
    });

    test("should allow any globally safe extension when a file upload has no survey restriction", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "element1",
              type: "fileUpload" as const,
            },
          ],
        },
      ] as unknown as TSurveyBlock[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "report.pdf", elementId: "element1", blocks })
      ).toEqual({
        ok: true,
      });
    });

    test("should reject surveys without file upload blocks or questions", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "element1",
              type: "openText" as const,
            },
          ],
        },
      ] as unknown as TSurveyBlock[];
      const questions = [
        {
          id: "question1",
          type: "openText" as const,
        },
      ] as TSurveyQuestion[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "report.pdf", elementId: "question1", blocks, questions })
      ).toEqual({
        ok: false,
        reason: "no_file_upload_element",
      });
    });

    test("should reject when no file upload entry allows the requested extension", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "element1",
              type: "fileUpload" as const,
              allowedFileExtensions: ["jpg"],
            },
            {
              id: "element2",
              type: "fileUpload" as const,
              allowedFileExtensions: ["png"],
            },
          ],
        },
      ] as unknown as TSurveyBlock[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "report.pdf", elementId: "element2", blocks })
      ).toEqual({
        ok: false,
        reason: "file_extension_not_allowed",
      });
    });

    test("should allow when any file upload entry permits the requested extension", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "element1",
              type: "fileUpload" as const,
              allowedFileExtensions: ["jpg"],
            },
            {
              id: "element2",
              type: "fileUpload" as const,
              allowedFileExtensions: ["pdf"],
            },
          ],
        },
      ] as unknown as TSurveyBlock[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "report.pdf", elementId: "element2", blocks })
      ).toEqual({
        ok: true,
      });
    });

    test("should reject files without a globally safe extension even when the survey has an unrestricted upload", () => {
      const questions = [
        {
          id: "question1",
          type: "fileUpload" as const,
        },
      ] as TSurveyQuestion[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "report", elementId: "question1", questions })
      ).toEqual({
        ok: false,
        reason: "file_extension_not_allowed",
      });
      expect(
        validateSurveyAllowsFileUpload({ fileName: "malware.exe", elementId: "question1", questions })
      ).toEqual({
        ok: false,
        reason: "file_extension_not_allowed",
      });
    });

    test("should reject an element id that is not the file upload element", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "element1",
              type: "fileUpload" as const,
              allowedFileExtensions: ["pdf"],
            },
          ],
        },
      ] as unknown as TSurveyBlock[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "report.pdf", elementId: "element2", blocks })
      ).toEqual({
        ok: false,
        reason: "file_upload_element_not_found",
      });
    });
  });

  describe("validateSurveyAllowsFileUpload for a Signature element", () => {
    const blocks = [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          { id: "sig1", type: "signature" as const },
          { id: "text1", type: "openText" as const },
        ],
      },
    ] as unknown as TSurveyBlock[];

    test("should allow a png upload for the Signature element", () => {
      expect(
        validateSurveyAllowsFileUpload({ fileName: "signature.png", elementId: "sig1", blocks })
      ).toEqual({ ok: true });
      expect(
        validateSurveyAllowsFileUpload({ fileName: "SIGNATURE.PNG", elementId: "sig1", blocks })
      ).toEqual({ ok: true });
    });

    test.each(["signature.pdf", "signature.jpg", "signature.svg", "signature.webp", "signature"])(
      "should refuse %s for the Signature element: png only",
      (fileName) => {
        expect(validateSurveyAllowsFileUpload({ fileName, elementId: "sig1", blocks })).toEqual({
          ok: false,
          reason: "file_extension_not_allowed",
        });
      }
    );

    test("should refuse an element that is not an upload element", () => {
      expect(validateSurveyAllowsFileUpload({ fileName: "a.png", elementId: "text1", blocks })).toEqual({
        ok: false,
        reason: "file_upload_element_not_found",
      });
    });

    test("should allow a png upload for a legacy Signature question", () => {
      const questions = [{ id: "legacy-sig", type: "signature" as const }] as unknown as TSurveyQuestion[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "signature.png", elementId: "legacy-sig", questions })
      ).toEqual({ ok: true });
      expect(
        validateSurveyAllowsFileUpload({ fileName: "signature.pdf", elementId: "legacy-sig", questions })
      ).toEqual({ ok: false, reason: "file_extension_not_allowed" });
    });

    test("should leave the File upload extension rules unchanged next to a Signature element", () => {
      const mixed = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            { id: "sig1", type: "signature" as const },
            { id: "file1", type: "fileUpload" as const, allowedFileExtensions: ["pdf"] },
            { id: "file2", type: "fileUpload" as const },
          ],
        },
      ] as unknown as TSurveyBlock[];

      expect(
        validateSurveyAllowsFileUpload({ fileName: "a.pdf", elementId: "file1", blocks: mixed })
      ).toEqual({ ok: true });
      expect(
        validateSurveyAllowsFileUpload({ fileName: "a.png", elementId: "file1", blocks: mixed })
      ).toEqual({ ok: false, reason: "file_extension_not_allowed" });
      expect(
        validateSurveyAllowsFileUpload({ fileName: "a.jpg", elementId: "file2", blocks: mixed })
      ).toEqual({ ok: true });
    });
  });

  const noUploadElementIds = {
    fileUpload: new Set<string>(),
    signature: new Set<string>(),
    live: new Set<string>(),
  };

  describe("getSurveyFileUploadElementIds", () => {
    test("should union the file-upload ids from blocks and questions", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            { id: "block-upload", type: "fileUpload" as const },
            { id: "block-text", type: "openText" as const },
          ],
        },
      ] as unknown as TSurveyBlock[];
      const questions = [
        { id: "question-upload", type: "fileUpload" as const },
        { id: "question-text", type: "openText" as const },
      ] as unknown as TSurveyQuestion[];

      expect(getSurveyFileUploadElementIds({ blocks, questions })).toEqual({
        fileUpload: new Set(["block-upload", "question-upload"]),
        signature: new Set(),
        live: new Set(["block-upload", "block-text", "question-upload", "question-text"]),
      });
    });

    test("should keep Signature ids apart from file-upload ids, in blocks and in legacy questions", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            { id: "block-upload", type: "fileUpload" as const },
            { id: "block-signature", type: "signature" as const },
          ],
        },
      ] as unknown as TSurveyBlock[];
      const questions = [
        { id: "question-upload", type: "fileUpload" as const },
        { id: "question-signature", type: "signature" as const },
      ] as unknown as TSurveyQuestion[];

      expect(getSurveyFileUploadElementIds({ blocks, questions })).toEqual({
        fileUpload: new Set(["block-upload", "question-upload"]),
        signature: new Set(["block-signature", "question-signature"]),
        live: new Set(["block-upload", "block-signature", "question-upload", "question-signature"]),
      });
    });

    test("should be empty for a survey with no upload element", () => {
      expect(getSurveyFileUploadElementIds({ blocks: [], questions: [] })).toEqual(noUploadElementIds);
      expect(getSurveyFileUploadElementIds({})).toEqual(noUploadElementIds);
    });
  });

  describe("collectResponseFileUrls", () => {
    const surveyId = "survey-1";
    const otherSurveyId = "survey-2";
    const fileUploadElementIds = {
      fileUpload: new Set(["upload"]),
      signature: new Set<string>(),
      live: new Set(["upload", "text", "choices"]),
    };
    const firstUrl = "https://example.com/storage/ws-1/private/one.png";
    const secondUrl = "https://example.com/storage/ws-1/private/two.pdf";
    const scopedUrl = (keySurveyId: string, fileName: string, accessType = "private") =>
      `/storage/ws-1/${accessType}/surveys/${keySurveyId}/elements/removed-upload/${fileName}`;

    test("should collect the URLs under file-upload keys and ignore every other answer", () => {
      const data: TResponseData = {
        upload: [firstUrl, secondUrl],
        text: "not a file",
        "not-an-upload-element": ["https://example.com/storage/ws-1/private/other.png"],
      };

      expect(collectResponseFileUrls(data, fileUploadElementIds, surveyId)).toEqual([firstUrl, secondUrl]);
    });

    // The delete paths used to cast a matching answer straight to string[]. A non-array value therefore
    // became a delete target instead of being skipped, so a plain string holding a valid same-workspace
    // URL was deleted off malformed data.
    test("should skip a non-array answer under a file-upload key", () => {
      expect(collectResponseFileUrls({ upload: firstUrl }, fileUploadElementIds, surveyId)).toEqual([]);
      expect(collectResponseFileUrls({ upload: { url: firstUrl } }, fileUploadElementIds, surveyId)).toEqual(
        []
      );
      expect(collectResponseFileUrls({ upload: 42 }, fileUploadElementIds, surveyId)).toEqual([]);
    });

    test("should drop non-string entries inside a file-upload array", () => {
      expect(
        collectResponseFileUrls({ upload: [42, null, firstUrl] }, fileUploadElementIds, surveyId)
      ).toEqual([firstUrl]);
    });

    test("should collect no flat key when the survey has no file-upload element", () => {
      expect(collectResponseFileUrls({ upload: [firstUrl] }, noUploadElementIds, surveyId)).toEqual([]);
    });

    test("should collect nothing for data that is not a response object", () => {
      for (const data of [null, undefined, "", "a string", 42, [firstUrl]]) {
        expect(collectResponseFileUrls(data, fileUploadElementIds, surveyId)).toEqual([]);
      }
    });

    // The key names the survey that owns the file, so an answer left by an upload element since deleted
    // from the survey is still this survey's to clean up. Matching on current element ids alone orphaned
    // these files in storage for good.
    test("should collect this survey's private scoped URL under a key that is no longer an upload element", () => {
      const ownFile = scopedUrl(surveyId, "own.png");

      expect(
        collectResponseFileUrls({ "removed-upload": [ownFile] }, fileUploadElementIds, surveyId)
      ).toEqual([ownFile]);
      expect(collectResponseFileUrls({ "removed-upload": [ownFile] }, noUploadElementIds, surveyId)).toEqual([
        ownFile,
      ]);
    });

    // A same-workspace URL planted under a key that later became an upload element (ENG-2291) passes
    // `deleteResponseFileUrls`' workspace check, so collection is what keeps it from deleting another
    // survey's file — encoded spellings included, since the delete path decodes before building the key.
    test.each([
      ["a plain key", scopedUrl(otherSurveyId, "victim.png")],
      ["an encoded segment", `/storage/ws-1/private/%73urveys/${otherSurveyId}/elements/upload/victim.png`],
      ["encoded slashes", `/storage/ws-1/private/surveys%2F${otherSurveyId}%2Felements%2Fupload%2Fv.png`],
    ])("should refuse another survey's scoped URL under a current upload element (%s)", (_label, url) => {
      expect(collectResponseFileUrls({ upload: [url] }, fileUploadElementIds, surveyId)).toEqual([]);
    });

    // Write-time validation only stores a key under the element it names, so a this-survey key under any
    // other answer was pasted there. Collecting it would let deleting one response remove another
    // respondent's upload.
    test.each([
      ["a multi-select answer", { choices: [scopedUrl(surveyId, "victim.png")] }],
      ["another upload element", { upload: [scopedUrl(surveyId, "victim.png")] }],
      [
        "encoded slashes",
        { upload: [`/storage/ws-1/private/surveys%2F${surveyId}%2Felements%2Fremoved-upload%2Fv.png`] },
      ],
      ["a key with no element", { upload: [`/storage/ws-1/private/surveys/${surveyId}/v.png`] }],
    ])("should refuse this survey's scoped URL under %s", (_label, data) => {
      expect(collectResponseFileUrls(data, fileUploadElementIds, surveyId)).toEqual([]);
    });

    test("should read an encoded scoped URL naming this survey as this survey's", () => {
      const encodedOwnFile = `/storage/ws-1/private/%73urveys/${surveyId}/elements/removed-upload/own.png`;

      expect(
        collectResponseFileUrls({ "removed-upload": [encodedOwnFile] }, noUploadElementIds, surveyId)
      ).toEqual([encodedOwnFile]);
    });

    // Respondent uploads are always private, so a public key filed under a survey is never one of them.
    test("should never collect a public scoped URL", () => {
      const publicFile = scopedUrl(surveyId, "public.png", "public");

      expect(collectResponseFileUrls({ upload: [publicFile] }, fileUploadElementIds, surveyId)).toEqual([]);
      expect(
        collectResponseFileUrls({ "removed-upload": [publicFile] }, noUploadElementIds, surveyId)
      ).toEqual([]);
    });

    // Only array answers can hold uploads, so a URL pasted into a text answer is never a delete target,
    // even one that names this survey.
    test("should never collect a scoped URL from a non-array answer", () => {
      expect(
        collectResponseFileUrls({ text: scopedUrl(surveyId, "pasted.png") }, fileUploadElementIds, surveyId)
      ).toEqual([]);
    });

    describe("Signature answers (one URL string, ADR 0016)", () => {
      const signatureIds = {
        fileUpload: new Set(["upload"]),
        signature: new Set(["sig"]),
        live: new Set(["upload", "sig", "text"]),
      };
      const signatureUrl = (keySurveyId: string, elementId = "sig", fileName = "signature--fid--abc.png") =>
        `/storage/ws-1/private/surveys/${keySurveyId}/elements/${elementId}/${fileName}`;

      test("should collect a Signature answer's own URL", () => {
        const own = signatureUrl(surveyId);

        expect(collectResponseFileUrls({ sig: own }, signatureIds, surveyId)).toEqual([own]);
      });

      test("should collect a Signature URL and File upload URLs from the same response", () => {
        const own = signatureUrl(surveyId);

        expect(collectResponseFileUrls({ sig: own, upload: [firstUrl] }, signatureIds, surveyId)).toEqual([
          own,
          firstUrl,
        ]);
      });

      test("should collect an absolute own Signature URL", () => {
        const own = `https://app.example.com${signatureUrl(surveyId)}`;

        expect(collectResponseFileUrls({ sig: own }, signatureIds, surveyId)).toEqual([own]);
      });

      // The element decides, never the value's shape: even a key that names the answer's own element is
      // not a target when that element is live and not a Signature.
      test.each([
        ["an open text answer", { text: signatureUrl(surveyId, "text") }],
        ["a File upload answer", { upload: signatureUrl(surveyId, "upload") }],
      ])("should never collect a bare string URL under a live %s", (_label, data) => {
        expect(collectResponseFileUrls(data, signatureIds, surveyId)).toEqual([]);
        expect(collectResponseFileUrls(data, fileUploadElementIds, surveyId)).toEqual([]);
      });

      // A deleted element, or one retyped away from Signature, leaves its answer under an id the survey
      // no longer has; its image has to go with the response.
      test("should collect a bare string URL under an id the survey no longer has, when its key is this survey's and that element's", () => {
        const orphan = signatureUrl(surveyId, "removed-signature");

        expect(collectResponseFileUrls({ "removed-signature": orphan }, signatureIds, surveyId)).toEqual([
          orphan,
        ]);
      });

      test("should not collect the same URL once the id is a live text element", () => {
        const url = signatureUrl(surveyId, "was-signature");

        expect(collectResponseFileUrls({ "was-signature": url }, signatureIds, surveyId)).toEqual([url]);
        expect(
          collectResponseFileUrls(
            { "was-signature": url },
            { ...signatureIds, live: new Set([...signatureIds.live, "was-signature"]) },
            surveyId
          )
        ).toEqual([]);
      });

      test.each([
        ["another survey's", signatureUrl(otherSurveyId, "removed-signature")],
        ["another element's", signatureUrl(surveyId, "other-element")],
        [
          "another workspace's key under a flat shape",
          "/storage/ws-2/private/removed-signature--fid--abc.png",
        ],
        ["a public", `/storage/ws-1/public/surveys/${surveyId}/elements/removed-signature/s.png`],
        ["a plain string", "not a url"],
        ["an empty string", ""],
      ])("should refuse %s URL under an id the survey no longer has", (_label, url) => {
        expect(collectResponseFileUrls({ "removed-signature": url }, signatureIds, surveyId)).toEqual([]);
      });

      test("should collect an array of own scoped URLs under a Signature id", () => {
        const first = signatureUrl(surveyId);
        const second = signatureUrl(surveyId, "sig", "second--fid--def.png");

        expect(
          collectResponseFileUrls(
            { sig: [first, second, 42, signatureUrl(otherSurveyId), signatureUrl(surveyId, "other")] },
            signatureIds,
            surveyId
          )
        ).toEqual([first, second]);
      });

      test("should leave a File upload's array collected after the element is retyped to Signature", () => {
        const upload = `/storage/ws-1/private/surveys/${surveyId}/elements/was-upload/photo--fid--abc.png`;
        const retyped = {
          fileUpload: new Set<string>(),
          signature: new Set(["was-upload"]),
          live: new Set(["was-upload"]),
        };

        expect(collectResponseFileUrls({ "was-upload": [upload] }, retyped, surveyId)).toEqual([upload]);
      });

      test.each([
        ["another survey's", signatureUrl(otherSurveyId)],
        ["another element's", signatureUrl(surveyId, "other-element")],
        ["a File upload element's", signatureUrl(surveyId, "upload")],
        ["a key with no element", `/storage/ws-1/private/surveys/${surveyId}/signature.png`],
        ["a flat pre-#8044 key", "/storage/ws-1/private/signature--fid--abc.png"],
        ["a public key", `/storage/ws-1/public/surveys/${surveyId}/elements/sig/signature.png`],
        [
          "an encoded foreign survey key",
          `/storage/ws-1/private/%73urveys/${otherSurveyId}/elements/sig/signature.png`,
        ],
        [
          "encoded slashes naming a foreign survey",
          `/storage/ws-1/private/surveys%2F${otherSurveyId}%2Felements%2Fsig%2Fsignature.png`,
        ],
      ])("should refuse %s URL under a Signature answer", (_label, url) => {
        expect(collectResponseFileUrls({ sig: url }, signatureIds, surveyId)).toEqual([]);
      });

      test("should collect nothing for a non-URL or non-string answer under a Signature id", () => {
        const own = signatureUrl(surveyId);

        for (const answer of [{ url: own }, 42, null, true, "", "not a url"]) {
          expect(collectResponseFileUrls({ sig: answer }, signatureIds, surveyId)).toEqual([]);
        }
      });

      test("should log refused Signature URLs as a count, never the URL", () => {
        const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
        onTestFinished(() => warnSpy.mockRestore());

        collectResponseFileUrls({ sig: signatureUrl(otherSurveyId) }, signatureIds, surveyId);

        expect(warnSpy).toHaveBeenCalledWith(
          { surveyId, refusedCount: 1 },
          "Refusing response files filed under another survey or element"
        );
      });
    });

    describe("refusal log", () => {
      const spyOnWarn = () => {
        const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
        onTestFinished(() => warnSpy.mockRestore());
        return warnSpy;
      };

      // The count is the only trace a planted URL leaves once the binding refuses it. Only a private key
      // naming another survey or element counts, and the URLs themselves stay out of the log.
      test("should log once how many URLs were refused for naming another survey or element, without the URLs", () => {
        const warnSpy = spyOnWarn();

        collectResponseFileUrls(
          {
            upload: [
              scopedUrl(otherSurveyId, "a.png"),
              scopedUrl(otherSurveyId, "p.png", "public"),
              scopedUrl(surveyId, "c.png"),
              firstUrl,
            ],
            "removed-upload": [scopedUrl("survey-3", "b.png"), secondUrl, "not a url"],
          },
          fileUploadElementIds,
          surveyId
        );

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
          { surveyId, refusedCount: 3 },
          "Refusing response files filed under another survey or element"
        );
      });

      test("should not log for a multi-select answer of plain labels", () => {
        const warnSpy = spyOnWarn();

        collectResponseFileUrls(
          { choices: ["Option A", "Option B", "Other"], upload: [firstUrl] },
          fileUploadElementIds,
          surveyId
        );

        expect(warnSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe("validateClientFileUploads", () => {
    const workspaceId = "clxworkspace123";
    const surveyId = "clxsurvey123";
    const elementId = "file_element";
    const blocks = [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          {
            id: elementId,
            type: "fileUpload" as const,
            allowedFileExtensions: ["pdf"],
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    test("should accept scoped private storage URLs for the matching survey and element", () => {
      const responseData = {
        [elementId]: [
          `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
        ],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(true);
    });

    test("should reject unscoped legacy storage URLs for new client submissions", () => {
      const responseData = {
        [elementId]: [`/storage/${workspaceId}/private/report--fid--abc.pdf`],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    test("should reject scoped URLs for a different workspace (cross-tenant, ENG-1981)", () => {
      // A storage URL whose workspace segment belongs to ANOTHER tenant must never validate:
      // persisting it would let response-deletion cleanup delete that tenant's file by storageId.
      const responseData = {
        [elementId]: [
          `/storage/otherWorkspace/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
        ],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    test("should reject scoped URLs for a different survey", () => {
      const responseData = {
        [elementId]: [
          `/storage/${workspaceId}/private/surveys/otherSurvey/elements/${elementId}/report--fid--abc.pdf`,
        ],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    test("should reject scoped URLs for a different element", () => {
      const responseData = {
        [elementId]: [
          `/storage/${workspaceId}/private/surveys/${surveyId}/elements/otherElement/report--fid--abc.pdf`,
        ],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    test("should reject external URLs", () => {
      const responseData = {
        [elementId]: ["https://example.com/report--fid--abc.pdf"],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    test("should reject file extensions not allowed by the matching upload element", () => {
      const responseData = {
        [elementId]: [
          `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/image--fid--abc.png`,
        ],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    test("should accept an app-origin absolute URL (the shape a GET response returns for re-submission)", () => {
      // A response GET resolves the stored relative URL to an absolute one against the app's base
      // (resolveStorageUrl); re-submitting that value must still validate. Build it via the same
      // helper so the origin matches whatever WEBAPP_URL is in the test environment.
      const absoluteUrl = resolveStorageUrl(
        `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
        "private"
      );
      const responseData = { [elementId]: [absoluteUrl] };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(true);
    });

    test("should reject a foreign-origin absolute URL even when its path is correctly scoped", () => {
      // A scoped path under a non-app origin must not slip through — otherwise an attacker could
      // persist a link that renders to users pointing at an arbitrary host.
      const responseData = {
        [elementId]: [
          `https://attacker.example.com/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
        ],
      };

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    // ENG-1981 review (Anshuman): file URLs uploaded before #8044 are only 4 parts
    // (/storage/{prefix}/private/{file}) and never recorded a survey/element. A management caller
    // replaying such a stored response (backfills, re-imports, two-way integrations) must still
    // validate the URL — but only when {prefix} is a storage namespace the workspace owns, so
    // cross-tenant deletion stays closed. legacyOwnedStoragePrefixes carries the owned prefixes
    // (workspace id + Workspace.legacyEnvironmentId); it is empty for the client widget path.
    describe("legacy 4-part URLs (management replay of pre-#8044 responses)", () => {
      const legacyEnvironmentId = "env_legacy_abc";

      test("accepts a legacy URL whose prefix is the workspace id (Formbricks 5 shape)", () => {
        const responseData = {
          [elementId]: [`/storage/${workspaceId}/private/resume--fid--u1.pdf`],
        };

        expect(
          validateClientFileUploads({
            data: responseData,
            workspaceId,
            surveyId,
            blocks,
            legacyOwnedStoragePrefixes: [workspaceId, legacyEnvironmentId],
          })
        ).toBe(true);
      });

      test("accepts a legacy URL whose prefix is the workspace's legacyEnvironmentId (pre-Formbricks 5 shape)", () => {
        const responseData = {
          [elementId]: [`/storage/${legacyEnvironmentId}/private/resume--fid--u1.pdf`],
        };

        expect(
          validateClientFileUploads({
            data: responseData,
            workspaceId,
            surveyId,
            blocks,
            legacyOwnedStoragePrefixes: [workspaceId, legacyEnvironmentId],
          })
        ).toBe(true);
      });

      test("accepts an app-origin absolute legacy URL whose prefix is owned", () => {
        const absoluteUrl = resolveStorageUrl(
          `/storage/${legacyEnvironmentId}/private/resume--fid--u1.pdf`,
          "private"
        );
        const responseData = { [elementId]: [absoluteUrl] };

        expect(
          validateClientFileUploads({
            data: responseData,
            workspaceId,
            surveyId,
            blocks,
            legacyOwnedStoragePrefixes: [workspaceId, legacyEnvironmentId],
          })
        ).toBe(true);
      });

      test("rejects a legacy URL whose prefix belongs to another tenant (cross-tenant, ENG-1981)", () => {
        // The prefix is the only part that decides whose file a later cleanup deletes, so a legacy
        // URL naming a prefix this workspace does not own must never validate.
        const responseData = {
          [elementId]: [`/storage/env_other_tenant/private/resume--fid--u1.pdf`],
        };

        expect(
          validateClientFileUploads({
            data: responseData,
            workspaceId,
            surveyId,
            blocks,
            legacyOwnedStoragePrefixes: [workspaceId, legacyEnvironmentId],
          })
        ).toBe(false);
      });

      test("rejects a legacy public URL even when the prefix is owned (file-upload answers are private)", () => {
        const responseData = {
          [elementId]: [`/storage/${workspaceId}/public/resume--fid--u1.pdf`],
        };

        expect(
          validateClientFileUploads({
            data: responseData,
            workspaceId,
            surveyId,
            blocks,
            legacyOwnedStoragePrefixes: [workspaceId, legacyEnvironmentId],
          })
        ).toBe(false);
      });

      test("rejects a legacy URL when no owned prefixes are supplied (client widget path stays strict)", () => {
        const responseData = {
          [elementId]: [`/storage/${workspaceId}/private/resume--fid--u1.pdf`],
        };

        expect(
          validateClientFileUploads({
            data: responseData,
            workspaceId,
            surveyId,
            blocks,
            legacyOwnedStoragePrefixes: [],
          })
        ).toBe(false);
      });

      test("still accepts the current scoped 8-part shape when owned prefixes are supplied", () => {
        const responseData = {
          [elementId]: [
            `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
          ],
        };

        expect(
          validateClientFileUploads({
            data: responseData,
            workspaceId,
            surveyId,
            blocks,
            legacyOwnedStoragePrefixes: [workspaceId, legacyEnvironmentId],
          })
        ).toBe(true);
      });
    });

    describe("questions-only surveys (legacy shape passed by all four management routes)", () => {
      const questions = [
        {
          id: elementId,
          type: "fileUpload" as const,
          allowedFileExtensions: ["pdf"],
        },
      ] as unknown as TSurveyQuestion[];

      test("accepts a scoped URL resolved from a fileUpload question", () => {
        const responseData = {
          [elementId]: [
            `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
          ],
        };

        expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, questions })).toBe(
          true
        );
      });

      test("rejects a cross-tenant URL resolved from a fileUpload question", () => {
        const responseData = {
          [elementId]: [
            `/storage/otherWorkspace/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
          ],
        };

        expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, questions })).toBe(
          false
        );
      });
    });

    test("returns true when there is no response data", () => {
      expect(validateClientFileUploads({ data: undefined, workspaceId, surveyId, blocks })).toBe(true);
    });

    test("rejects when a file-upload answer is not an array", () => {
      const responseData = {
        [elementId]: `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
      } as unknown as TResponseData;

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });

    test("rejects when a file-upload answer array contains a non-string entry", () => {
      const responseData = {
        [elementId]: [
          `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
          123,
        ],
      } as unknown as TResponseData;

      expect(validateClientFileUploads({ data: responseData, workspaceId, surveyId, blocks })).toBe(false);
    });
  });

  describe("validateClientFileUploads for a Signature element", () => {
    const workspaceId = "clxworkspace123";
    const surveyId = "clxsurvey123";
    const elementId = "signature_element";
    const blocks = [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          { id: elementId, type: "signature" as const },
          { id: "file_element", type: "fileUpload" as const, allowedFileExtensions: ["pdf"] },
          { id: "text_element", type: "openText" as const },
        ],
      },
    ] as unknown as TSurveyBlock[];
    const ownUrl = `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/signature--fid--abc.png`;
    const validate = (
      data: unknown,
      overrides: Partial<Parameters<typeof validateClientFileUploads>[0]> = {}
    ) =>
      validateClientFileUploads({
        data: data as TResponseData,
        workspaceId,
        surveyId,
        blocks,
        ...overrides,
      });

    test("should accept the Signature element's own png URL as a single string", () => {
      expect(validate({ [elementId]: ownUrl })).toBe(true);
    });

    test("should accept an app-origin absolute URL, the shape a GET response returns for re-submission", () => {
      expect(validate({ [elementId]: resolveStorageUrl(ownUrl, "private") })).toBe(true);
    });

    test("should accept a skipped Signature as an empty string or no key", () => {
      expect(validate({ [elementId]: "" })).toBe(true);
      expect(validate({})).toBe(true);
    });

    test("should reject an array under a Signature id", () => {
      expect(validate({ [elementId]: [ownUrl] })).toBe(false);
      expect(validate({ [elementId]: [] })).toBe(false);
    });

    test.each([null, 42, true, { url: "x" }])("should reject %j under a Signature id", (answer) => {
      expect(validate({ [elementId]: answer })).toBe(false);
    });

    test.each([
      [
        "another workspace's",
        `/storage/otherWorkspace/private/surveys/${surveyId}/elements/${elementId}/s.png`,
      ],
      ["another survey's", `/storage/${workspaceId}/private/surveys/otherSurvey/elements/${elementId}/s.png`],
      [
        "another element's",
        `/storage/${workspaceId}/private/surveys/${surveyId}/elements/otherElement/s.png`,
      ],
      [
        "a File upload element's",
        `/storage/${workspaceId}/private/surveys/${surveyId}/elements/file_element/s.png`,
      ],
      ["a public", `/storage/${workspaceId}/public/surveys/${surveyId}/elements/${elementId}/s.png`],
      ["a foreign-origin absolute", `https://evil.example.com${ownUrl}`],
      ["an external", "https://example.com/signature.png"],
      ["a non-png", `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/s.pdf`],
      ["a jpg", `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/s.jpg`],
      ["a flat pre-#8044", `/storage/${workspaceId}/private/signature--fid--abc.png`],
    ])("should reject %s URL under a Signature id", (_label, url) => {
      expect(validate({ [elementId]: url })).toBe(false);
    });

    test("should not accept a pre-#8044 flat key for a Signature even from a management route", () => {
      expect(
        validate(
          { [elementId]: `/storage/${workspaceId}/private/signature--fid--abc.png` },
          { legacyOwnedStoragePrefixes: [workspaceId] }
        )
      ).toBe(false);
    });

    test("should keep File upload strict: a bare string is still rejected, an array still accepted", () => {
      const fileUrl = `/storage/${workspaceId}/private/surveys/${surveyId}/elements/file_element/report--fid--abc.pdf`;

      expect(validate({ file_element: fileUrl })).toBe(false);
      expect(validate({ file_element: [fileUrl] })).toBe(true);
    });

    test("should not treat a plain text answer holding a storage URL as an upload", () => {
      expect(validate({ text_element: "https://example.com/anything" })).toBe(true);
    });

    test("should read the legacy questions shape too", () => {
      const questions = [{ id: "legacy-sig", type: "signature" }] as unknown as TSurveyQuestion[];
      const legacyUrl = `/storage/${workspaceId}/private/surveys/${surveyId}/elements/legacy-sig/s--fid--abc.png`;

      expect(validate({ "legacy-sig": legacyUrl }, { blocks: undefined, questions })).toBe(true);
      expect(validate({ "legacy-sig": [legacyUrl] }, { blocks: undefined, questions })).toBe(false);
      expect(validate({ "legacy-sig": ownUrl }, { blocks: undefined, questions })).toBe(false);
    });
  });

  describe("parseStorageFileUrl", () => {
    test("should parse nested relative storage URLs", () => {
      expect(
        parseStorageFileUrl(
          "/storage/workspace-123/private/surveys/survey-123/elements/element-123/report.pdf"
        )
      ).toEqual({
        storageId: "workspace-123",
        accessType: "private",
        fileName: "surveys/survey-123/elements/element-123/report.pdf",
      });
    });

    test("should parse absolute storage URLs", () => {
      expect(parseStorageFileUrl("https://example.com/storage/workspace-123/public/report.pdf")).toEqual({
        storageId: "workspace-123",
        accessType: "public",
        fileName: "report.pdf",
      });
    });

    test.each([
      "https://example.com/not-storage/workspace-123/private/report.pdf",
      "/storage/workspace-123/internal/report.pdf",
      "/storage/workspace-123/private",
      "not a url",
    ])("should reject invalid storage URL %s", (fileUrl) => {
      expect(parseStorageFileUrl(fileUrl)).toBeNull();
    });
  });

  describe("getStorageUrlSurveyId", () => {
    test.each([
      ["a relative current upload", "/storage/ws-1/private/surveys/survey-1/elements/el-1/report.pdf"],
      [
        "an absolute current upload",
        "https://example.com/storage/ws-1/private/surveys/survey-1/elements/el-1/a.png",
      ],
      // The delete path decodes before building the key, so these name survey-1's folder too.
      ["an encoded segment", "/storage/ws-1/private/%73urveys/survey-1/elements/el-1/a.png"],
      ["encoded slashes", "/storage/ws-1/private/surveys%2Fsurvey-1%2Felements%2Fel-1%2Fa.png"],
    ])("should read the survey id from %s", (_label, fileUrl) => {
      expect(getStorageUrlSurveyId(fileUrl)).toBe("survey-1");
    });

    test.each([
      ["a flat pre-#8044 key", "/storage/ws-1/private/report--fid--abc.pdf"],
      ["a flat key named after the folder", "/storage/ws-1/private/surveys"],
      ["a name that does not decode", "/storage/ws-1/private/surveys%E0%A4%A/survey-1/a.png"],
      ["a non-storage URL", "https://example.com/files/surveys/survey-1/a.png"],
    ])("should return null for %s", (_label, fileUrl) => {
      expect(getStorageUrlSurveyId(fileUrl)).toBeNull();
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
      // ENG-1329: the allowlist is kept a subset of the upload allowlist (so the "upload to
      // Formbricks" hint is truthful). gif/avif/bmp aren't uploadable, and svg is an XSS vector.
      expect(isValidImageFile("https://example.com/image.gif")).toBe(false);
      expect(isValidImageFile("https://example.com/image.avif")).toBe(false);
      expect(isValidImageFile("https://example.com/image.bmp")).toBe(false);
      expect(isValidImageFile("https://example.com/image.svg")).toBe(false);
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
