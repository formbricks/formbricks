import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock AWS SDK modules
vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
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
const mockGetObjectCommand = vi.mocked(GetObjectCommand);
const mockCreatePresignedPost = vi.mocked(createPresignedPost);
const mockGetSignedUrl = vi.mocked(getSignedUrl);

describe("service.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const mockConstants = {
    IS_FORMBRICKS_CLOUD: false,
    MAX_SIZES: {
      standard: 1024 * 1024 * 10, // 10MB
      big: 1024 * 1024 * 1024, // 1GB
    },
    S3_BUCKET_NAME: "test-bucket",
  };

  describe("getSignedUploadUrl", () => {
    test("should create presigned upload URL for non-Formbricks cloud environment", async () => {
      // Mock constants for non-cloud environment
      vi.doMock("./constants", () => mockConstants);

      // Mock createPresignedPost response
      const mockResponse = {
        fields: { key: "test-field" },
        url: "https://example.com",
      };

      mockCreatePresignedPost.mockResolvedValueOnce(mockResponse);

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("test-file.jpg", "image/jpeg", "uploads/images", false);

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(expect.any(Object), {
        Expires: 10 * 60,
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "uploads/images/test-file.jpg",
        Fields: {
          "Content-Type": "image/jpeg",
          "Content-Encoding": "base64",
        },
        Conditions: undefined, // No conditions for non-cloud
      });

      expect(result).toEqual({
        signedUrl: mockResponse.url,
        presignedFields: mockResponse.fields,
      });
    });

    test("should create presigned upload URL for Formbricks cloud with standard size", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        IS_FORMBRICKS_CLOUD: true,
      }));

      const mockResponse = {
        fields: { policy: "test-policy" },
        url: "https://example.com",
      };

      mockCreatePresignedPost.mockResolvedValueOnce(mockResponse);

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("document.pdf", "application/pdf", "documents", false);

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(expect.any(Object), {
        Expires: 10 * 60,
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "documents/document.pdf",
        Fields: {
          "Content-Type": "application/pdf",
          "Content-Encoding": "base64",
        },
        Conditions: [["content-length-range", 0, mockConstants.MAX_SIZES.standard]],
      });

      expect(result).toEqual({
        signedUrl: mockResponse.url,
        presignedFields: mockResponse.fields,
      });
    });

    test("should create presigned upload URL for Formbricks cloud with big file size", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        IS_FORMBRICKS_CLOUD: true,
      }));

      const mockResponse = {
        fields: { signature: "test-signature" },
        url: "https://example.com",
      };

      mockCreatePresignedPost.mockResolvedValueOnce(mockResponse);

      const { getSignedUploadUrl } = await import("./service");

      const result = await getSignedUploadUrl("large-video.mp4", "video/mp4", "videos", true);

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(expect.any(Object), {
        Expires: 10 * 60,
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "videos/large-video.mp4",
        Fields: {
          "Content-Type": "video/mp4",
          "Content-Encoding": "base64",
        },
        Conditions: [["content-length-range", 0, mockConstants.MAX_SIZES.big]],
      });

      expect(result).toEqual({
        signedUrl: mockResponse.url,
        presignedFields: mockResponse.fields,
      });
    });

    test("should handle undefined bucket name", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));

      const mockResponse = {
        fields: {},
        url: "https://example.com",
      };

      mockCreatePresignedPost.mockResolvedValueOnce(mockResponse);

      const { getSignedUploadUrl } = await import("./service");

      await getSignedUploadUrl("test.txt", "text/plain", "text", false);

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(expect.any(Object), {
        Expires: 10 * 60,
        Bucket: "", // Should default to empty string
        Key: "text/test.txt",
        Fields: {
          "Content-Type": "text/plain",
          "Content-Encoding": "base64",
        },
        Conditions: undefined,
      });
    });

    test("should use default value for isBiggerFileUploadAllowed parameter", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        IS_FORMBRICKS_CLOUD: true,
      }));

      const mockResponse = {
        fields: {},
        url: "https://test.com",
      };

      mockCreatePresignedPost.mockResolvedValueOnce(mockResponse);

      const { getSignedUploadUrl } = await import("./service");

      // Call without isBiggerFileUploadAllowed parameter (should default to false)
      await getSignedUploadUrl("test.jpg", "image/jpeg", "images");

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(expect.any(Object), {
        Expires: 10 * 60,
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "images/test.jpg",
        Fields: {
          "Content-Type": "image/jpeg",
          "Content-Encoding": "base64",
        },
        Conditions: [["content-length-range", 0, mockConstants.MAX_SIZES.standard]],
      });
    });
  });

  describe("getSignedDownloadUrl", () => {
    test("should create signed download URL", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const mockSignedUrl = "https://example.com/important-file.pdf?signature=abc123";
      mockGetSignedUrl.mockResolvedValueOnce(mockSignedUrl);

      const { getSignedDownloadUrl } = await import("./service");

      const result = await getSignedDownloadUrl("documents/important-file.pdf");

      expect(mockGetObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "documents/important-file.pdf",
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), // s3Client
        expect.any(Object), // GetObjectCommand instance
        { expiresIn: 60 * 30 } // 30 minutes
      );

      expect(result).toBe(mockSignedUrl);
    });

    test("should handle different file keys", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      mockGetSignedUrl.mockResolvedValueOnce("https://example.com/nested/file.jpg");

      const { getSignedDownloadUrl } = await import("./service");

      await getSignedDownloadUrl("path/to/nested/file.jpg");

      expect(mockGetObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "path/to/nested/file.jpg",
      });
    });
  });

  describe("deleteFile", () => {
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

      await deleteFile("files/to-delete.txt");

      expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "files/to-delete.txt",
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(Object));
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

      await deleteFile("deep/nested/path/file.zip");

      expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConstants.S3_BUCKET_NAME,
        Key: "deep/nested/path/file.zip",
      });
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

      await deleteFile("test-file.txt");

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});
