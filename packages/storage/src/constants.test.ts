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
  });
});
