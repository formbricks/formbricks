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

    test("should create S3 client when access key is missing (IAM role authentication)", async () => {
      // Mock constants with missing access key - should work with IAM roles
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockConstants.S3_REGION,
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should create S3 client when secret key is missing (IAM role authentication)", async () => {
      // Mock constants with missing secret key - should work with IAM roles
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_SECRET_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockConstants.S3_REGION,
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should create S3 client when both credentials are missing (IAM role authentication)", async () => {
      // Mock constants with no credentials - should work with IAM roles
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: undefined,
        S3_SECRET_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockConstants.S3_REGION,
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should create S3 client when credentials are empty strings (IAM role authentication)", async () => {
      // Mock constants with empty string credentials - should work with IAM roles
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: "",
        S3_SECRET_KEY: "",
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockConstants.S3_REGION,
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should create S3 client when mixed empty and undefined credentials (IAM role authentication)", async () => {
      // Mock constants with mixed empty and undefined - should work with IAM roles
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_ACCESS_KEY: "",
        S3_SECRET_KEY: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockConstants.S3_REGION,
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should create S3 client when region is missing (uses AWS SDK defaults)", async () => {
      // Mock constants with missing region - should still work
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_REGION: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: mockConstants.S3_ACCESS_KEY,
          secretAccessKey: mockConstants.S3_SECRET_KEY,
        },
        endpoint: mockConstants.S3_ENDPOINT_URL,
        forcePathStyle: mockConstants.S3_FORCE_PATH_STYLE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should create S3 client with only bucket name (minimal config for IAM roles)", async () => {
      // Mock constants with only bucket name - minimal required config
      vi.doMock("./constants", () => ({
        S3_ACCESS_KEY: undefined,
        S3_SECRET_KEY: undefined,
        S3_REGION: undefined,
        S3_BUCKET_NAME: "test-bucket",
        S3_ENDPOINT_URL: undefined,
        S3_FORCE_PATH_STYLE: false,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(mockS3Client).toHaveBeenCalledWith({
        endpoint: undefined,
        forcePathStyle: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should return error when bucket name is missing", async () => {
      // Mock constants with missing bucket name
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("s3_credentials_error");
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

    test("should return unknown error when S3Client constructor throws", async () => {
      // Provide valid credentials so we reach the constructor path
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      // Make the mocked S3Client throw on construction for this test only
      mockS3Client.mockImplementationOnce((..._args: [S3ClientConfig] | []): S3Client => {
        throw new Error("constructor failed");
      });

      const { createS3ClientFromEnv } = await import("./client");

      const result = createS3ClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unknown");
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
      // Mock constants with missing bucket name (the only required field)
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));

      const { createS3Client } = await import("./client");

      const result = createS3Client();

      expect(result).toBeUndefined();
    });
  });

  describe("getCachedS3Client (singleton)", () => {
    test("returns the same instance on multiple calls and constructs once", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const { getCachedS3Client } = await import("./client");
      const typedGetCachedS3Client = getCachedS3Client as unknown as () => S3Client;

      const first = typedGetCachedS3Client();
      const second = typedGetCachedS3Client();

      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first).toBe(second);
      expect(mockS3Client).toHaveBeenCalledTimes(1);
    });

    test("returns undefined when env is invalid and does not construct client", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
        S3_BUCKET_NAME: undefined,
      }));

      const { getCachedS3Client } = await import("./client");
      const typedGetCachedS3Client = getCachedS3Client as unknown as () => S3Client;

      const client = typedGetCachedS3Client();
      expect(client).toBeUndefined();
      expect(mockS3Client).not.toHaveBeenCalled();
    });

    test("createS3Client uses cached instance when available", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const { getCachedS3Client, createS3Client } = await import("./client");
      const typedGetCachedS3Client = getCachedS3Client as unknown as () => S3Client;

      const cached = typedGetCachedS3Client();
      const created = createS3Client();

      expect(cached).toBeDefined();
      expect(created).toBe(cached);
      expect(mockS3Client).toHaveBeenCalledTimes(1);
    });

    test("createS3Client returns provided client even if cache exists", async () => {
      vi.doMock("./constants", () => ({
        ...mockConstants,
      }));

      const { getCachedS3Client, createS3Client } = await import("./client");
      const typedGetCachedS3Client = getCachedS3Client as unknown as () => S3Client;
      const cached = typedGetCachedS3Client();
      expect(cached).toBeDefined();

      const injected = new S3Client({});
      const result = createS3Client(injected);

      expect(result).toBe(injected);
      // One construction for cached, one for injected
      expect(mockS3Client).toHaveBeenCalledTimes(2);
    });
  });
});
