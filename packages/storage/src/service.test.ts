import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock AWS SDK modules
vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  ListObjectsCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

// Mock client module
vi.mock("./client", () => ({
  createS3Client: vi.fn(() => ({
    send: vi.fn(),
  })),
}));

const mockDeleteObjectCommand = vi.mocked(DeleteObjectCommand);
const mockDeleteObjectsCommand = vi.mocked(DeleteObjectsCommand);
const mockGetObjectCommand = vi.mocked(GetObjectCommand);
const mockHeadObjectCommand = vi.mocked(HeadObjectCommand);
const mockListObjectsCommand = vi.mocked(ListObjectsCommand);
const mockCreatePresignedPost = vi.mocked(createPresignedPost);
const mockGetSignedUrl = vi.mocked(getSignedUrl);

describe("service.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const mockConstants = {
    S3_BUCKET_NAME: "test-bucket",
  };

  const mockMaxSize = 1024 * 1024 * 10; // 10MB

  describe("getSignedUploadUrl", () => {
    test("should create presigned upload URL", async () => {
      // Mock constants for non-cloud environment
      vi.doMock("./constants", () => mockConstants);

      // Mock createPresignedPost response
      const mockResponse = {
        fields: { key: "test-field" },
        url: "https://example.com",
      };

      mockCreatePresignedPost.mockResolvedValueOnce(mockResponse);

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("test-file.jpg", "image/jpeg", "uploads/images", mockMaxSize);

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(expect.any(Object), {
        Expires: 2 * 60,
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "uploads/images/test-file.jpg",
        Fields: {
          "Content-Type": "image/jpeg",
          "Content-Encoding": "base64",
        },
        Conditions: [["content-length-range", 0, mockMaxSize]],
      });

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toEqual({
          signedUrl: mockResponse.url,
          presignedFields: mockResponse.fields,
        });
      }
    });

    test("should return error if bucket name is not set", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("test.txt", "text/plain", "text", mockMaxSize);

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
      }
    });

    test("should return error if s3Client is null", async () => {
      vi.doMock("./constants", () => mockConstants);
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => undefined),
      }));

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("test.txt", "text/plain", "text", mockMaxSize);

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_client_error");
      }
    });

    test("should handle createPresignedPost throwing an error", async () => {
      vi.doMock("./constants", () => mockConstants);
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => ({
          send: vi.fn(),
        })),
      }));

      mockCreatePresignedPost.mockRejectedValueOnce(new Error("AWS Error"));

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("test.txt", "text/plain", "text", mockMaxSize);

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("unknown");
      }
    });

    test("should create presigned upload URL without maxSize", async () => {
      vi.doMock("./constants", () => mockConstants);
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => ({
          send: vi.fn(),
        })),
      }));

      const mockResponse = {
        fields: { key: "test-field" },
        url: "https://example.com",
      };

      mockCreatePresignedPost.mockResolvedValueOnce(mockResponse);

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("test-file.jpg", "image/jpeg", "uploads/images");

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(expect.any(Object), {
        Expires: 2 * 60,
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "uploads/images/test-file.jpg",
        Fields: {
          "Content-Type": "image/jpeg",
          "Content-Encoding": "base64",
        },
        Conditions: [["content-length-range", 0, mockMaxSize]],
      });

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toEqual({
          signedUrl: mockResponse.url,
          presignedFields: mockResponse.fields,
        });
      }
    });
  });

  describe("getSignedDownloadUrl", () => {
    test("should return error if bucket name is not set", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => ({
          send: vi.fn(),
        })),
      }));

      const { getSignedDownloadUrl } = await import("./service");

      const result = await getSignedDownloadUrl("documents/important-file.pdf");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
      }
    });

    test("should create signed download URL", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi
          .fn()
          .mockResolvedValueOnce({}) // HeadObjectCommand response (file exists)
          .mockResolvedValueOnce({}), // Any other send calls
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const mockSignedUrl = "https://example.com/important-file.pdf?signature=abc123";
      mockGetSignedUrl.mockResolvedValueOnce(mockSignedUrl);

      const { getSignedDownloadUrl } = await import("./service");

      const result = await getSignedDownloadUrl("documents/important-file.pdf");

      expect(mockHeadObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "documents/important-file.pdf",
      });

      expect(mockGetObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "documents/important-file.pdf",
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), // s3Client
        expect.any(Object), // GetObjectCommand instance
        { expiresIn: 60 * 30 } // 30 minutes
      );

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toBe(mockSignedUrl);
      }
    });

    test("should handle different file keys", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi
          .fn()
          .mockResolvedValueOnce({}) // HeadObjectCommand response (file exists)
          .mockResolvedValueOnce({}), // Any other send calls
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      mockGetSignedUrl.mockResolvedValueOnce("https://example.com/nested/file.jpg");

      const { getSignedDownloadUrl } = await import("./service");

      await getSignedDownloadUrl("path/to/nested/file.jpg");

      expect(mockHeadObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "path/to/nested/file.jpg",
      });

      expect(mockGetObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "path/to/nested/file.jpg",
      });
    });

    test("should return error if s3Client is null", async () => {
      vi.doMock("./constants", () => mockConstants);
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => undefined),
      }));

      const { getSignedDownloadUrl } = await import("./service");

      const result = await getSignedDownloadUrl("test-file.pdf");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_client_error");
      }
    });

    test("should handle getSignedUrl throwing an error", async () => {
      vi.doMock("./constants", () => mockConstants);

      const mockS3Client = {
        send: vi
          .fn()
          .mockResolvedValueOnce({}) // HeadObjectCommand response (file exists)
          .mockResolvedValueOnce({}), // Any other send calls
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      mockGetSignedUrl.mockRejectedValueOnce(new Error("AWS Error"));

      const { getSignedDownloadUrl } = await import("./service");

      const result = await getSignedDownloadUrl("test-file.pdf");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("unknown");
      }
    });

    test("should return file not found error when file does not exist", async () => {
      vi.doMock("./constants", () => mockConstants);

      const notFoundError = new Error("Not Found");
      notFoundError.name = "NotFound";

      const mockS3Client = {
        send: vi.fn().mockRejectedValueOnce(notFoundError),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { getSignedDownloadUrl } = await import("./service");

      const result = await getSignedDownloadUrl("non-existent-file.pdf");

      expect(mockHeadObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "non-existent-file.pdf",
      });

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("file_not_found_error");
      }
    });

    test("should return file not found error when S3 returns 404", async () => {
      vi.doMock("./constants", () => mockConstants);

      const notFoundError = {
        $metadata: { httpStatusCode: 404 },
      };

      const mockS3Client = {
        send: vi.fn().mockRejectedValueOnce(notFoundError),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { getSignedDownloadUrl } = await import("./service");

      const result = await getSignedDownloadUrl("another-non-existent-file.pdf");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("file_not_found_error");
      }
    });
  });

  describe("deleteFile", () => {
    test("should return error if bucket name is not set", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => ({
          send: vi.fn(),
        })),
      }));

      const { deleteFile } = await import("./service");

      const result = await deleteFile("test-file.txt");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
      }
    });

    test("should delete file from S3", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi.fn().mockResolvedValueOnce({}),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFile } = await import("./service");

      const result = await deleteFile("files/to-delete.txt");

      expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "files/to-delete.txt",
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(Object));

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    test("should handle different file keys for deletion", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi.fn().mockResolvedValueOnce({}),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFile } = await import("./service");

      const result = await deleteFile("deep/nested/path/file.zip");

      expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "deep/nested/path/file.zip",
      });

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    test("should not return anything", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi.fn().mockResolvedValueOnce({}),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFile } = await import("./service");

      const result = await deleteFile("test-file.txt");

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(Object));

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    test("should return error if s3Client is null", async () => {
      vi.doMock("./constants", () => mockConstants);
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => undefined),
      }));

      const { deleteFile } = await import("./service");

      const result = await deleteFile("test-file.txt");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_client_error");
      }
    });

    test("should handle s3Client.send throwing an error", async () => {
      vi.doMock("./constants", () => mockConstants);

      const mockS3Client = {
        send: vi.fn().mockRejectedValueOnce(new Error("AWS Error")),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFile } = await import("./service");

      const result = await deleteFile("test-file.txt");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("unknown");
      }
    });
  });

  describe("deleteFilesByPrefix", () => {
    test("should return error if bucket name is not set", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => ({
          send: vi.fn(),
        })),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("uploads/images/");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
      }
    });

    test("should return error if s3Client is null", async () => {
      vi.doMock("./constants", () => mockConstants);
      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => undefined),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("uploads/images/");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("s3_client_error");
      }
    });

    test("should delete multiple files with given prefix", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi
          .fn()
          .mockResolvedValueOnce({
            Contents: [
              { Key: "uploads/images/file1.jpg" },
              { Key: "uploads/images/file2.png" },
              { Key: "uploads/images/subfolder/file3.gif" },
            ],
          })
          .mockResolvedValueOnce({}), // DeleteObjectsCommand response
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("uploads/images/");

      expect(mockListObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Prefix: "uploads/images/",
      });

      expect(mockDeleteObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Delete: {
          Objects: [
            { Key: "uploads/images/file1.jpg" },
            { Key: "uploads/images/file2.png" },
            { Key: "uploads/images/subfolder/file3.gif" },
          ],
        },
      });

      expect(mockS3Client.send).toHaveBeenCalledTimes(2);

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    test("should handle empty result list (no files found)", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi.fn().mockResolvedValueOnce({
          Contents: undefined, // No files found
        }),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("uploads/non-existent/");

      expect(mockListObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Prefix: "uploads/non-existent/",
      });

      // Should not call DeleteObjectsCommand when no files found
      expect(mockDeleteObjectsCommand).not.toHaveBeenCalled();
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    test("should handle empty Contents array", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi.fn().mockResolvedValueOnce({
          Contents: [], // Empty array
        }),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("uploads/empty/");

      expect(mockListObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Prefix: "uploads/empty/",
      });

      // Should not call DeleteObjectsCommand when Contents is empty
      expect(mockDeleteObjectsCommand).not.toHaveBeenCalled();
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.data).toBeUndefined();
      }
    });

    test("should handle different prefix patterns", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockS3Client = {
        send: vi
          .fn()
          .mockResolvedValueOnce({
            Contents: [{ Key: "surveys/123/responses/response1.json" }],
          })
          .mockResolvedValueOnce({}),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("surveys/123/responses/");

      expect(mockListObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Prefix: "surveys/123/responses/",
      });

      expect(mockDeleteObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Delete: {
          Objects: [{ Key: "surveys/123/responses/response1.json" }],
        },
      });

      expect(result.ok).toBe(true);
    });

    test("should handle ListObjectsCommand throwing an error", async () => {
      vi.doMock("./constants", () => mockConstants);

      const mockS3Client = {
        send: vi.fn().mockRejectedValueOnce(new Error("AWS ListObjects Error")),
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("uploads/test/");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("unknown");
      }
    });

    test("should handle DeleteObjectsCommand throwing an error", async () => {
      vi.doMock("./constants", () => mockConstants);

      const mockS3Client = {
        send: vi
          .fn()
          .mockResolvedValueOnce({
            Contents: [{ Key: "test-file.txt" }],
          })
          .mockRejectedValueOnce(new Error("AWS Delete Error")), // DeleteObjectsCommand fails
      };

      vi.doMock("./client", () => ({
        createS3Client: vi.fn(() => mockS3Client),
      }));

      const { deleteFilesByPrefix } = await import("./service");

      const result = await deleteFilesByPrefix("uploads/test/");

      expect(mockListObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Prefix: "uploads/test/",
      });

      expect(mockDeleteObjectsCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Delete: {
          Objects: [{ Key: "test-file.txt" }],
        },
      });

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("unknown");
      }
    });
  });
});
