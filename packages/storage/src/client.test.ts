import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the AWS SDK S3Client
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation((config: S3ClientConfig) => ({
    config,
    send: vi.fn(),
  })),
}));

const mockS3Client = vi.mocked(S3Client);

describe("client.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const mockConstants = {
    S3_ACCESS_KEY: "test-access-key",
    S3_SECRET_KEY: "test-secret-key",
    S3_REGION: "us-east-1",
    S3_BUCKET_NAME: "test-bucket",
    S3_ENDPOINT_URL: undefined,
    S3_FORCE_PATH_STYLE: false,
  };

  describe("createS3ClientFromEnv", () => {
    test("should create S3 client with valid credentials", async () => {
      // Mock constants with valid credentials
      vi.doMock("./constants", () => mockConstants);

      // Dynamic import to get fresh module with mocked constants
      const { createS3ClientFromEnv } = await import("./client");

      const client = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: mockConstants.S3_ACCESS_KEY,
          secretAccessKey: mockConstants.S3_SECRET_KEY,
        },
        region: mockConstants.S3_REGION,
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(client.ok).toBe(true);

      if (client.ok) {
        expect(client.data).toBeDefined();
      }
    });

    test("should create S3 client with endpoint URL", async () => {
      // Mock constants with endpoint URL
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ENDPOINT_URL: "https://custom-endpoint.com",
        S3_FORCE_PATH_STYLE: true,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const client = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: mockConstants.S3_ACCESS_KEY,
          secretAccessKey: mockConstants.S3_SECRET_KEY,
        },
        region: mockConstants.S3_REGION,
        endpoint: "https://custom-endpoint.com",
        forcePathStyle: true,
      });

      expect(client.ok).toBe(true);

      if (client.ok) {
        expect(client.data).toBeDefined();
      }
    });

    test("should return error when access key is missing", async () => {
      // Mock constants with missing access key
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
        expect(result.error.message).toBe("S3 credentials are not set");
      }
    });

    test("should return error when secret key is missing", async () => {
      // Mock constants with missing secret key
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_SECRET_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
        expect(result.error.message).toBe("S3 credentials are not set");
      }
    });

    test("should return error when both credentials are missing", async () => {
      // Mock constants with no credentials
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: undefined,
        S3_SECRET_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
        expect(result.error.message).toBe("S3 credentials are not set");
      }
    });

    test("should return error when credentials are empty strings", async () => {
      // Mock constants with empty string credentials
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: "",
        S3_SECRET_KEY: "",
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
        expect(result.error.message).toBe("S3 credentials are not set");
      }
    });

    test("should return error when mixed empty and undefined credentials", async () => {
      // Mock constants with mixed empty and undefined
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: "",
        S3_SECRET_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
        expect(result.error.message).toBe("S3 credentials are not set");
      }
    });

    test("should handle empty endpoint URL", async () => {
      // Mock constants with empty endpoint URL
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ENDPOINT_URL: "",
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: mockConstants.S3_ACCESS_KEY,
          secretAccessKey: mockConstants.S3_SECRET_KEY,
        },
        region: mockConstants.S3_REGION,
        endpoint: "",
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });
  });

  describe("createS3Client", () => {
    test("should return provided S3 client when passed", async () => {
      // Use a fresh import to avoid module cache issues
      const { createS3Client } = await import("./client");
      const mockClient = new S3Client({});

      const result = createS3Client(mockClient);

      expect(result).toBe(mockClient);
    });

    test("should create new client from environment when no client provided", async () => {
      // Mock constants for this test
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const { createS3Client } = await import("./client");

      const result = createS3Client();

      expect(mockS3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: mockConstants.S3_ACCESS_KEY,
          secretAccessKey: mockConstants.S3_SECRET_KEY,
        },
        region: mockConstants.S3_REGION,
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result).toBeDefined();
    });

    test("should return undefined when creating from env fails and no client provided", async () => {
      // Mock constants with missing credentials
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: undefined,
        S3_SECRET_KEY: undefined,
      }));

      const { createS3Client } = await import("./client");

      const result = createS3Client();

      expect(result).toBeUndefined();
    });
  });
});
