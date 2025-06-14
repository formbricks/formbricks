import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock AWS SDK
const mockSend = vi.fn();
const mockS3Client = {
  send: mockSend,
};

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => mockS3Client),
  HeadBucketCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(() =>
    Promise.resolve({
      url: "https://test-bucket.s3.test-region.amazonaws.com",
      fields: { key: "test-key", policy: "test-policy" },
    })
  ),
}));

// Mock environment variables
vi.mock("../constants", () => ({
  S3_ACCESS_KEY: "test-access-key",
  S3_SECRET_KEY: "test-secret-key",
  S3_REGION: "test-region",
  S3_BUCKET_NAME: "test-bucket",
  S3_ENDPOINT_URL: "http://test-endpoint",
  S3_FORCE_PATH_STYLE: true,
  isS3Configured: () => true,
  IS_FORMBRICKS_CLOUD: false,
  MAX_SIZES: {
    standard: 5 * 1024 * 1024,
    big: 10 * 1024 * 1024,
  },
  WEBAPP_URL: "http://test-webapp",
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
  UPLOADS_DIR: "/tmp/uploads",
}));

// Mock getPublicDomain
vi.mock("../getPublicUrl", () => ({
  getPublicDomain: () => "https://public-domain.com",
}));

// Mock crypto functions
vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid",
}));

// Mock local signed url generation
vi.mock("../crypto", () => ({
  generateLocalSignedUrl: () => ({
    signature: "test-signature",
    timestamp: 123456789,
    uuid: "test-uuid",
  }),
}));

// Mock env
vi.mock("../env", () => ({
  env: {
    S3_BUCKET_NAME: "test-bucket",
  },
}));

describe("Storage Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getS3Client", () => {
    test("should create and return S3 client instance", async () => {
      const { getS3Client } = await import("./service");
      const client = getS3Client();
      expect(client).toBe(mockS3Client);
      expect(S3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
        region: "test-region",
        endpoint: "http://test-endpoint",
        forcePathStyle: true,
      });
    });

    test("should return existing client instance on subsequent calls", async () => {
      vi.resetModules();
      const { getS3Client } = await import("./service");
      const client1 = getS3Client();
      const client2 = getS3Client();
      expect(client1).toBe(client2);
      expect(S3Client).toHaveBeenCalledTimes(1);
    });
  });

  describe("testS3BucketAccess", () => {
    let testS3BucketAccess: any;

    beforeEach(async () => {
      const serviceModule = await import("./service");
      testS3BucketAccess = serviceModule.testS3BucketAccess;
    });

    test("should return true when bucket access is successful", async () => {
      mockSend.mockResolvedValueOnce({});
      const result = await testS3BucketAccess();
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test("should throw error when bucket access fails", async () => {
      const error = new Error("Access denied");
      mockSend.mockRejectedValueOnce(error);
      await expect(testS3BucketAccess()).rejects.toThrow(
        "S3 Bucket Access Test Failed: Error: Access denied"
      );
    });
  });

  describe("putFile", () => {
    let putFile: any;

    beforeEach(async () => {
      const serviceModule = await import("./service");
      putFile = serviceModule.putFile;
    });

    test("should successfully upload file to S3", async () => {
      const fileName = "test.jpg";
      const fileBuffer = Buffer.from("test");
      const accessType = "private";
      const environmentId = "env123";

      mockSend.mockResolvedValueOnce({});

      const result = await putFile(fileName, fileBuffer, accessType, environmentId);
      expect(result).toEqual({ success: true, message: "File uploaded" });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test("should throw error when S3 upload fails", async () => {
      const fileName = "test.jpg";
      const fileBuffer = Buffer.from("test");
      const accessType = "private";
      const environmentId = "env123";

      const error = new Error("Upload failed");
      mockSend.mockRejectedValueOnce(error);

      await expect(putFile(fileName, fileBuffer, accessType, environmentId)).rejects.toThrow("Upload failed");
    });
  });

  describe("getUploadSignedUrl", () => {
    let getUploadSignedUrl: any;

    beforeEach(async () => {
      const serviceModule = await import("./service");
      getUploadSignedUrl = serviceModule.getUploadSignedUrl;
    });

    test("should use PUBLIC_URL for public files with S3", async () => {
      const result = await getUploadSignedUrl("test.jpg", "env123", "image/jpeg", "public");

      expect(result.fileUrl).toContain("https://public-domain.com");
      expect(result.fileUrl).toMatch(
        /https:\/\/public-domain\.com\/storage\/env123\/public\/test--fid--test-uuid\.jpg/
      );
    });

    test("should use WEBAPP_URL for private files with S3", async () => {
      const result = await getUploadSignedUrl("test.jpg", "env123", "image/jpeg", "private");

      expect(result.fileUrl).toContain("http://test-webapp");
      expect(result.fileUrl).toMatch(
        /http:\/\/test-webapp\/storage\/env123\/private\/test--fid--test-uuid\.jpg/
      );
    });

    test("should contain signed URL and presigned fields for S3", async () => {
      const result = await getUploadSignedUrl("test.jpg", "env123", "image/jpeg", "public");

      expect(result.signedUrl).toBe("https://test-bucket.s3.test-region.amazonaws.com");
      expect(result.presignedFields).toEqual({ key: "test-key", policy: "test-policy" });
    });
  });
});
