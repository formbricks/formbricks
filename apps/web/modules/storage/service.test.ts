import { randomUUID } from "crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { StorageErrorCode } from "@formbricks/storage";
import { TAccessType } from "@formbricks/types/storage";
import {
  deleteFile,
  deleteFilesByEnvironmentId,
  getFileStreamForDownload,
  getSignedUrlForUpload,
} from "./service";

// Mock external dependencies
vi.mock("crypto", () => ({
  randomUUID: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@formbricks/storage", () => ({
  StorageErrorCode: {
    Unknown: "unknown",
    S3ClientError: "s3_client_error",
    S3CredentialsError: "s3_credentials_error",
    FileNotFoundError: "file_not_found_error",
    InvalidInput: "invalid_input",
  },
  deleteFile: vi.fn(),
  deleteFilesByPrefix: vi.fn(),
  getFileStream: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  getSignedUploadUrl: vi.fn(),
}));

// Import mocked dependencies
const { logger } = await import("@formbricks/logger");
const storageModule = await import("@formbricks/storage");
const {
  deleteFile: deleteFileFromS3,
  deleteFilesByPrefix,
  getSignedUploadUrl,
  getFileStream,
} = storageModule;
type MockedSignedUploadReturn = Awaited<ReturnType<typeof getSignedUploadUrl>>;
type MockedFileStreamReturn = Awaited<ReturnType<typeof getFileStream>>;
type MockedDeleteFileReturn = Awaited<ReturnType<typeof deleteFile>>;
type MockedDeleteFilesByPrefixReturn = Awaited<ReturnType<typeof deleteFilesByPrefix>>;

const mockUUID = "test-uuid-123-456-789-10";

describe("storage service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(randomUUID).mockReturnValue(mockUUID);
  });

  describe("getSignedUrlForUpload", () => {
    test("should generate signed URL for upload with unique filename", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: {
          signedUrl: "https://s3.example.com/upload",
          presignedFields: { key: "value" },
        },
      } as MockedSignedUploadReturn;

      vi.mocked(getSignedUploadUrl).mockResolvedValue(mockSignedUrlResponse);

      const result = await getSignedUrlForUpload(
        "test-image.jpg",
        "env-123",
        "image/jpeg",
        "public" as TAccessType
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          signedUrl: "https://s3.example.com/upload",
          presignedFields: { key: "value" },
          fileUrl: `/storage/env-123/public/test-image--fid--${mockUUID}.jpg`,
        });
      }

      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        `test-image--fid--${mockUUID}.jpg`,
        "image/jpeg",
        "env-123/public",
        1024 * 1024 * 10 // 10MB default
      );
    });

    test("should return relative URL for private files", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: {
          signedUrl: "https://s3.example.com/upload",
          presignedFields: { key: "value" },
        },
      } as MockedSignedUploadReturn;

      vi.mocked(getSignedUploadUrl).mockResolvedValue(mockSignedUrlResponse);

      const result = await getSignedUrlForUpload(
        "test-doc.pdf",
        "env-123",
        "application/pdf",
        "private" as TAccessType
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.fileUrl).toBe(`/storage/env-123/private/test-doc--fid--${mockUUID}.pdf`);
      }
    });

    test("should properly sanitize filenames with special characters like # in URL", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: {
          signedUrl: "https://s3.example.com/upload",
          presignedFields: { key: "value" },
        },
      } as MockedSignedUploadReturn;

      vi.mocked(getSignedUploadUrl).mockResolvedValue(mockSignedUrlResponse);

      const result = await getSignedUrlForUpload(
        "test#file.txt",
        "env-123",
        "text/plain",
        "public" as TAccessType
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // The filename should be URL-encoded to prevent # from being treated as a URL fragment
        expect(result.data.fileUrl).toBe(`/storage/env-123/public/testfile--fid--${mockUUID}.txt`);
      }

      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        `testfile--fid--${mockUUID}.txt`,
        "text/plain",
        "env-123/public",
        1024 * 1024 * 10 // 10MB default
      );
    });

    test("should handle files with multiple dots in filename", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: {
          signedUrl: "https://s3.example.com/upload",
          presignedFields: { key: "value" },
        },
      } as MockedSignedUploadReturn;

      vi.mocked(getSignedUploadUrl).mockResolvedValue(mockSignedUrlResponse);

      const result = await getSignedUrlForUpload(
        "my.backup.file.pdf",
        "env-123",
        "application/pdf",
        "public" as TAccessType
      );

      expect(result.ok).toBe(true);
      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        `my.backup.file--fid--${mockUUID}.pdf`,
        "application/pdf",
        "env-123/public",
        1024 * 1024 * 10
      );
    });

    test("should use custom maxFileUploadSize when provided", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: {
          signedUrl: "https://s3.example.com/upload",
          presignedFields: { key: "value" },
        },
      } as MockedSignedUploadReturn;

      vi.mocked(getSignedUploadUrl).mockResolvedValue(mockSignedUrlResponse);

      await getSignedUrlForUpload(
        "large-file.pdf",
        "env-123",
        "application/pdf",
        "public" as TAccessType,
        1024 * 1024 * 50 // 50MB
      );

      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        `large-file--fid--${mockUUID}.pdf`,
        "application/pdf",
        "env-123/public",
        1024 * 1024 * 50
      );
    });

    test("should return error when getSignedUploadUrl fails", async () => {
      const mockErrorResponse = {
        ok: false,
        error: {
          code: StorageErrorCode.S3ClientError,
        },
      } as MockedSignedUploadReturn;

      vi.mocked(getSignedUploadUrl).mockResolvedValue(mockErrorResponse);

      const result = await getSignedUrlForUpload(
        "test-file.pdf",
        "env-123",
        "application/pdf",
        "public" as TAccessType
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.S3ClientError);
      }
    });

    test("should handle unexpected errors and return unknown error", async () => {
      vi.mocked(getSignedUploadUrl).mockRejectedValue(new Error("Unexpected error"));

      const result = await getSignedUrlForUpload(
        "test-file.pdf",
        "env-123",
        "application/pdf",
        "public" as TAccessType
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.Unknown);
      }
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        "Error getting signed url for upload"
      );
    });

    test("should return InvalidInput when sanitized filename is empty or invalid", async () => {
      const mockErrorResponse = {
        ok: false,
        error: { code: StorageErrorCode.InvalidInput },
      } as MockedSignedUploadReturn;

      vi.mocked(getSignedUploadUrl).mockResolvedValue(mockErrorResponse);

      const result = await getSignedUrlForUpload("----.png", "env-123", "image/png", "public" as TAccessType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.InvalidInput);
      }
    });
  });

  describe("deleteFile", () => {
    test("should call deleteFileFromS3 with correct file key", async () => {
      const mockSuccessResult = {
        ok: true,
        data: undefined,
      } as MockedDeleteFileReturn;

      vi.mocked(deleteFileFromS3).mockResolvedValue(mockSuccessResult);

      const result = await deleteFile("env-123", "public" as TAccessType, "test-file.jpg");

      expect(result).toEqual(mockSuccessResult);
      expect(deleteFileFromS3).toHaveBeenCalledWith("env-123/public/test-file.jpg");
    });

    test("should handle private access type", async () => {
      const mockSuccessResult = {
        ok: true,
        data: undefined,
      } as MockedDeleteFileReturn;

      vi.mocked(deleteFileFromS3).mockResolvedValue(mockSuccessResult);

      const result = await deleteFile("env-456", "private" as TAccessType, "private-doc.pdf");

      expect(result).toEqual(mockSuccessResult);
      expect(deleteFileFromS3).toHaveBeenCalledWith("env-456/private/private-doc.pdf");
    });

    test("should handle when deleteFileFromS3 returns error", async () => {
      const mockErrorResult = {
        ok: false,
        error: {
          code: StorageErrorCode.Unknown,
        },
      } as MockedDeleteFileReturn;

      vi.mocked(deleteFileFromS3).mockResolvedValue(mockErrorResult);

      const result = await deleteFile("env-123", "public" as TAccessType, "test-file.jpg");

      expect(result).toEqual(mockErrorResult);
      expect(deleteFileFromS3).toHaveBeenCalledWith("env-123/public/test-file.jpg");
    });
  });

  describe("deleteFilesByEnvironmentId", () => {
    test("should call deleteFilesByPrefix with environment ID", async () => {
      const mockSuccessResult = {
        ok: true,
        data: undefined,
      } as MockedDeleteFilesByPrefixReturn;

      vi.mocked(deleteFilesByPrefix).mockResolvedValue(mockSuccessResult);

      const result = await deleteFilesByEnvironmentId("env-123");

      expect(result).toEqual(mockSuccessResult);
      expect(deleteFilesByPrefix).toHaveBeenCalledWith("env-123");
    });

    test("should handle when deleteFilesByPrefix returns error", async () => {
      const mockErrorResult = {
        ok: false,
        error: {
          code: StorageErrorCode.Unknown,
        },
      } as MockedDeleteFilesByPrefixReturn;

      vi.mocked(deleteFilesByPrefix).mockResolvedValue(mockErrorResult);

      const result = await deleteFilesByEnvironmentId("env-123");

      expect(result).toEqual(mockErrorResult);
      expect(deleteFilesByPrefix).toHaveBeenCalledWith("env-123");
    });
  });

  describe("getFileStreamForDownload", () => {
    test("should return file stream for public file", async () => {
      const mockStream = new ReadableStream();
      const mockStreamResult = {
        ok: true,
        data: {
          body: mockStream,
          contentType: "image/jpeg",
          contentLength: 12345,
        },
      } as MockedFileStreamReturn;

      vi.mocked(getFileStream).mockResolvedValue(mockStreamResult);

      const result = await getFileStreamForDownload("test-image.jpg", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.body).toBe(mockStream);
        expect(result.data.contentType).toBe("image/jpeg");
        expect(result.data.contentLength).toBe(12345);
      }
      expect(getFileStream).toHaveBeenCalledWith("env-123/public/test-image.jpg");
    });

    test("should return file stream for private file", async () => {
      const mockStream = new ReadableStream();
      const mockStreamResult = {
        ok: true,
        data: {
          body: mockStream,
          contentType: "application/pdf",
          contentLength: 54321,
        },
      } as MockedFileStreamReturn;

      vi.mocked(getFileStream).mockResolvedValue(mockStreamResult);

      const result = await getFileStreamForDownload("document.pdf", "env-456", "private" as TAccessType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.contentType).toBe("application/pdf");
      }
      expect(getFileStream).toHaveBeenCalledWith("env-456/private/document.pdf");
    });

    test("should decode URL-encoded filename", async () => {
      const mockStream = new ReadableStream();
      const mockStreamResult = {
        ok: true,
        data: {
          body: mockStream,
          contentType: "image/png",
          contentLength: 1000,
        },
      } as MockedFileStreamReturn;

      vi.mocked(getFileStream).mockResolvedValue(mockStreamResult);

      // URL-encoded filename with spaces: "my file.png" -> "my%20file.png"
      const result = await getFileStreamForDownload("my%20file.png", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(true);
      // Should decode %20 to space before passing to getFileStream
      expect(getFileStream).toHaveBeenCalledWith("env-123/public/my file.png");
    });

    test("should return error when getFileStream fails with FileNotFoundError", async () => {
      const mockErrorResult = {
        ok: false,
        error: {
          code: StorageErrorCode.FileNotFoundError,
        },
      } as MockedFileStreamReturn;

      vi.mocked(getFileStream).mockResolvedValue(mockErrorResult);

      const result = await getFileStreamForDownload("missing-file.jpg", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.FileNotFoundError);
      }
    });

    test("should return error when getFileStream fails with S3ClientError", async () => {
      const mockErrorResult = {
        ok: false,
        error: {
          code: StorageErrorCode.S3ClientError,
        },
      } as MockedFileStreamReturn;

      vi.mocked(getFileStream).mockResolvedValue(mockErrorResult);

      const result = await getFileStreamForDownload("some-file.jpg", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.S3ClientError);
      }
    });

    test("should handle unexpected errors and return unknown error", async () => {
      vi.mocked(getFileStream).mockRejectedValue(new Error("Unexpected S3 error"));

      const result = await getFileStreamForDownload("test-file.jpg", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.Unknown);
      }
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        "Error getting file stream for download"
      );
    });

    test("should handle filename with fid pattern", async () => {
      const mockStream = new ReadableStream();
      const mockStreamResult = {
        ok: true,
        data: {
          body: mockStream,
          contentType: "image/jpeg",
          contentLength: 5000,
        },
      } as MockedFileStreamReturn;

      vi.mocked(getFileStream).mockResolvedValue(mockStreamResult);

      const result = await getFileStreamForDownload(
        "photo--fid--abc123-def456.jpg",
        "env-123",
        "public" as TAccessType
      );

      expect(result.ok).toBe(true);
      expect(getFileStream).toHaveBeenCalledWith("env-123/public/photo--fid--abc123-def456.jpg");
    });
  });
});
