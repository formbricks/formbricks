import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("constants.ts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Reset process.env to a clean state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("environment variable exports", () => {
    test("should export S3_ACCESS_KEY from environment", async () => {
      process.env.S3_ACCESS_KEY = "test-access-key-123";

      const { S3_ACCESS_KEY } = await import("./constants");

      expect(S3_ACCESS_KEY).toBe("test-access-key-123");
    });

    test("should export undefined when S3_ACCESS_KEY is not set", async () => {
      delete process.env.S3_ACCESS_KEY;

      const { S3_ACCESS_KEY } = await import("./constants");

      expect(S3_ACCESS_KEY).toBeUndefined();
    });

    test("should export S3_SECRET_KEY from environment", async () => {
      process.env.S3_SECRET_KEY = "test-secret-key-456";

      const { S3_SECRET_KEY } = await import("./constants");

      expect(S3_SECRET_KEY).toBe("test-secret-key-456");
    });

    test("should export undefined when S3_SECRET_KEY is not set", async () => {
      delete process.env.S3_SECRET_KEY;

      const { S3_SECRET_KEY } = await import("./constants");

      expect(S3_SECRET_KEY).toBeUndefined();
    });

    test("should export S3_REGION from environment", async () => {
      process.env.S3_REGION = "eu-west-1";

      const { S3_REGION } = await import("./constants");

      expect(S3_REGION).toBe("eu-west-1");
    });

    test("should export undefined when S3_REGION is not set", async () => {
      delete process.env.S3_REGION;

      const { S3_REGION } = await import("./constants");

      expect(S3_REGION).toBeUndefined();
    });

    test("should export S3_ENDPOINT_URL from environment", async () => {
      process.env.S3_ENDPOINT_URL = "https://custom-s3-endpoint.com";

      const { S3_ENDPOINT_URL } = await import("./constants");

      expect(S3_ENDPOINT_URL).toBe("https://custom-s3-endpoint.com");
    });

    test("should export undefined when S3_ENDPOINT_URL is not set", async () => {
      delete process.env.S3_ENDPOINT_URL;

      const { S3_ENDPOINT_URL } = await import("./constants");

      expect(S3_ENDPOINT_URL).toBeUndefined();
    });

    test("should export S3_BUCKET_NAME from environment", async () => {
      process.env.S3_BUCKET_NAME = "my-storage-bucket";

      const { S3_BUCKET_NAME } = await import("./constants");

      expect(S3_BUCKET_NAME).toBe("my-storage-bucket");
    });

    test("should export undefined when S3_BUCKET_NAME is not set", async () => {
      delete process.env.S3_BUCKET_NAME;

      const { S3_BUCKET_NAME } = await import("./constants");

      expect(S3_BUCKET_NAME).toBeUndefined();
    });
  });

  describe("boolean conversion constants", () => {
    describe("S3_FORCE_PATH_STYLE", () => {
      test("should be true when S3_FORCE_PATH_STYLE is '1'", async () => {
        process.env.S3_FORCE_PATH_STYLE = "1";

        const { S3_FORCE_PATH_STYLE } = await import("./constants");

        expect(S3_FORCE_PATH_STYLE).toBe(true);
      });

      test("should be false when S3_FORCE_PATH_STYLE is '0'", async () => {
        process.env.S3_FORCE_PATH_STYLE = "0";

        const { S3_FORCE_PATH_STYLE } = await import("./constants");

        expect(S3_FORCE_PATH_STYLE).toBe(false);
      });

      test("should be false when S3_FORCE_PATH_STYLE is undefined", async () => {
        delete process.env.S3_FORCE_PATH_STYLE;

        const { S3_FORCE_PATH_STYLE } = await import("./constants");

        expect(S3_FORCE_PATH_STYLE).toBe(false);
      });
    });

    describe("IS_FORMBRICKS_CLOUD", () => {
      test("should be true when IS_FORMBRICKS_CLOUD is '1'", async () => {
        process.env.IS_FORMBRICKS_CLOUD = "1";

        const { IS_FORMBRICKS_CLOUD } = await import("./constants");

        expect(IS_FORMBRICKS_CLOUD).toBe(true);
      });

      test("should be false when IS_FORMBRICKS_CLOUD is '0'", async () => {
        process.env.IS_FORMBRICKS_CLOUD = "0";

        const { IS_FORMBRICKS_CLOUD } = await import("./constants");

        expect(IS_FORMBRICKS_CLOUD).toBe(false);
      });

      test("should be false when IS_FORMBRICKS_CLOUD is undefined", async () => {
        delete process.env.IS_FORMBRICKS_CLOUD;

        const { IS_FORMBRICKS_CLOUD } = await import("./constants");

        expect(IS_FORMBRICKS_CLOUD).toBe(false);
      });
    });
  });

  describe("MAX_SIZES constant", () => {
    test("should export correct MAX_SIZES object", async () => {
      const { MAX_SIZES } = await import("./constants");

      expect(MAX_SIZES).toEqual({
        standard: 1024 * 1024 * 10, // 10MB
        big: 1024 * 1024 * 1024, // 1GB
      });
    });

    test("should have standard size of 10MB", async () => {
      const { MAX_SIZES } = await import("./constants");

      expect(MAX_SIZES.standard).toBe(10485760); // 10 * 1024 * 1024
    });

    test("should have big size of 1GB", async () => {
      const { MAX_SIZES } = await import("./constants");

      expect(MAX_SIZES.big).toBe(1073741824); // 1024 * 1024 * 1024
    });
  });
});
