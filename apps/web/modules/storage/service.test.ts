import { randomUUID } from "crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { StorageErrorCode } from "@formbricks/storage";
import { TAccessType } from "@formbricks/types/storage";
import {
  deleteFile,
  deleteFilesByEnvironmentId,
  getSignedUrlForDownload,
  getSignedUrlForUpload,
} from "./service";

// Mock external dependencies
vi.mock("crypto", () => ({
  randomUUID: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "https://webapp.example.com",
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn(),
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
  getSignedDownloadUrl: vi.fn(),
  getSignedUploadUrl: vi.fn(),
}));

// Import mocked dependencies
const { logger } = await import("@formbricks/logger");
const { getPublicDomain } = await import("@/lib/getPublicUrl");
const {
  deleteFile: deleteFileFromS3,
  deleteFilesByPrefix,
  getSignedDownloadUrl,
  getSignedUploadUrl,
} = await import("@formbricks/storage");

type MockedSignedUploadReturn = Awaited<ReturnType<typeof getSignedUploadUrl>>;
type MockedSignedDownloadReturn = Awaited<ReturnType<typeof getSignedDownloadUrl>>;
type MockedDeleteFileReturn = Awaited<ReturnType<typeof deleteFile>>;
type MockedDeleteFilesByPrefixReturn = Awaited<ReturnType<typeof deleteFilesByPrefix>>;

const mockUUID = "test-uuid-123-456-789-10";

describe("storage service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(randomUUID).mockReturnValue(mockUUID);
    vi.mocked(getPublicDomain).mockReturnValue("https://public.example.com");
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
          fileUrl: `https://public.example.com/storage/env-123/public/test-image--fid--${mockUUID}.jpg`,
        });
      }

      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        `test-image--fid--${mockUUID}.jpg`,
        "image/jpeg",
        "env-123/public",
        1024 * 1024 * 10 // 10MB default
      );
    });

    test("should use WEBAPP_URL for private files", async () => {
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
        expect(result.data.fileUrl).toBe(
          `https://webapp.example.com/storage/env-123/private/test-doc--fid--${mockUUID}.pdf`
        );
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
        expect(result.data.fileUrl).toBe(
          `https://public.example.com/storage/env-123/public/testfile--fid--${mockUUID}.txt`
        );
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

  describe("getSignedUrlForDownload", () => {
    test("should generate signed URL for download", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: "https://s3.example.com/download?signature=abc123",
      } as MockedSignedDownloadReturn;

      vi.mocked(getSignedDownloadUrl).mockResolvedValue(mockSignedUrlResponse);

      const result = await getSignedUrlForDownload("test-file.jpg", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe("https://s3.example.com/download?signature=abc123");
      }
      expect(getSignedDownloadUrl).toHaveBeenCalledWith("env-123/public/test-file.jpg");
    });

    test("should decode URI-encoded filename", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: "https://s3.example.com/download?signature=abc123",
      } as MockedSignedDownloadReturn;

      vi.mocked(getSignedDownloadUrl).mockResolvedValue(mockSignedUrlResponse);

      const encodedFileName = encodeURIComponent("file with spaces.jpg");
      await getSignedUrlForDownload(encodedFileName, "env-123", "private" as TAccessType);

      expect(getSignedDownloadUrl).toHaveBeenCalledWith("env-123/private/file with spaces.jpg");
    });

    test("should return error when getSignedDownloadUrl fails", async () => {
      const mockErrorResponse = {
        ok: false,
        error: {
          code: StorageErrorCode.S3ClientError,
        },
      } as MockedSignedDownloadReturn;

      vi.mocked(getSignedDownloadUrl).mockResolvedValue(mockErrorResponse);

      const result = await getSignedUrlForDownload("missing-file.jpg", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.S3ClientError);
      }
    });

    test("should handle unexpected errors and return unknown error", async () => {
      vi.mocked(getSignedDownloadUrl).mockRejectedValue(new Error("Network error"));

      const result = await getSignedUrlForDownload("test-file.jpg", "env-123", "public" as TAccessType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.Unknown);
      }
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        "Error getting signed url for download"
      );
    });

    test("should handle files with special characters", async () => {
      const mockSignedUrlResponse = {
        ok: true,
        data: "https://s3.example.com/download?signature=abc123",
      } as MockedSignedDownloadReturn;

      vi.mocked(getSignedDownloadUrl).mockResolvedValue(mockSignedUrlResponse);

      const specialFileName = "file%20with%20%26%20symbols.jpg";
      await getSignedUrlForDownload(specialFileName, "env-123", "public" as TAccessType);

      expect(getSignedDownloadUrl).toHaveBeenCalledWith("env-123/public/file with & symbols.jpg");
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
});
