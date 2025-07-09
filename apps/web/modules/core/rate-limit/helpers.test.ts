import { hashString } from "@/lib/hash-string";
// Import modules after mocking
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { err, ok } from "@formbricks/types/error-handlers";
import { applyIPRateLimit, applyRateLimit, getClientIdentifier } from "./helpers";
import { checkRateLimit } from "./rate-limit";

// Mock all dependencies
vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: vi.fn(),
}));

vi.mock("@/lib/hash-string", () => ({
  hashString: vi.fn(),
}));

vi.mock("./rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getClientIdentifier", () => {
    test("should get client IP and return hashed identifier", async () => {
      const mockIp = "192.168.1.1";
      const mockHashedIp = "abc123hashedip";

      (getClientIpFromHeaders as any).mockResolvedValue(mockIp);
      (hashString as any).mockReturnValue(mockHashedIp);

      const result = await getClientIdentifier();

      expect(getClientIpFromHeaders).toHaveBeenCalledOnce();
      expect(hashString).toHaveBeenCalledWith(mockIp);
      expect(result).toBe(mockHashedIp);

      // Verify no error was logged on successful hashing
      expect(logger.error).not.toHaveBeenCalled();
    });

    test("should handle IP retrieval errors", async () => {
      const mockError = new Error("Failed to get IP");
      (getClientIpFromHeaders as any).mockRejectedValue(mockError);

      await expect(getClientIdentifier()).rejects.toThrow("Failed to get IP");
    });

    test("should handle hashing errors with proper logging", async () => {
      const mockIp = "192.168.1.1";
      const originalError = new Error("Hashing failed");

      (getClientIpFromHeaders as any).mockResolvedValue(mockIp);
      (hashString as any).mockImplementation(() => {
        throw originalError;
      });

      await expect(getClientIdentifier()).rejects.toThrow("Failed to hash IP");

      // Verify that the error was logged with proper context
      expect(logger.error).toHaveBeenCalledWith("Failed to hash IP", { error: originalError });
    });
  });

  describe("applyRateLimit", () => {
    const mockConfig = {
      interval: 300,
      allowedPerInterval: 5,
      namespace: "test",
    };

    const mockIdentifier = "test-identifier";

    test("should allow request when rate limit check passes", async () => {
      (checkRateLimit as any).mockResolvedValue(ok({ allowed: true }));

      await expect(applyRateLimit(mockConfig, mockIdentifier)).resolves.toBeUndefined();

      expect(checkRateLimit).toHaveBeenCalledWith(mockConfig, mockIdentifier);
    });

    test("should throw error when rate limit is exceeded", async () => {
      (checkRateLimit as any).mockResolvedValue(ok({ allowed: false }));

      await expect(applyRateLimit(mockConfig, mockIdentifier)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );

      expect(checkRateLimit).toHaveBeenCalledWith(mockConfig, mockIdentifier);
    });

    test("should throw error when rate limit check fails", async () => {
      (checkRateLimit as any).mockResolvedValue(err("Redis connection failed"));

      await expect(applyRateLimit(mockConfig, mockIdentifier)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );

      expect(checkRateLimit).toHaveBeenCalledWith(mockConfig, mockIdentifier);
    });

    test("should throw error when rate limit check throws exception", async () => {
      const mockError = new Error("Unexpected error");
      (checkRateLimit as any).mockRejectedValue(mockError);

      await expect(applyRateLimit(mockConfig, mockIdentifier)).rejects.toThrow("Unexpected error");

      expect(checkRateLimit).toHaveBeenCalledWith(mockConfig, mockIdentifier);
    });

    test("should work with different configurations", async () => {
      const customConfig = {
        interval: 3600,
        allowedPerInterval: 100,
        namespace: "api:v1",
      };

      (checkRateLimit as any).mockResolvedValue(ok({ allowed: true }));

      await expect(applyRateLimit(customConfig, "api-key-identifier")).resolves.toBeUndefined();

      expect(checkRateLimit).toHaveBeenCalledWith(customConfig, "api-key-identifier");
    });

    test("should work with different identifiers", async () => {
      (checkRateLimit as any).mockResolvedValue(ok({ allowed: true }));

      const identifiers = ["user-123", "ip-192.168.1.1", "auth-login-hashedip", "api-key-abc123"];

      for (const identifier of identifiers) {
        await expect(applyRateLimit(mockConfig, identifier)).resolves.toBeUndefined();
        expect(checkRateLimit).toHaveBeenCalledWith(mockConfig, identifier);
      }

      expect(checkRateLimit).toHaveBeenCalledTimes(identifiers.length);
    });
  });

  describe("applyIPRateLimit", () => {
    test("should be a convenience function that gets IP and applies rate limit", async () => {
      // This is an integration test - the function calls getClientIdentifier internally
      // and then calls applyRateLimit, which we've already tested extensively
      const mockConfig = {
        interval: 3600,
        allowedPerInterval: 100,
        namespace: "test:page",
      };

      // Mock the IP getting functions
      (getClientIpFromHeaders as any).mockResolvedValue("192.168.1.1");
      (hashString as any).mockReturnValue("hashed-ip-123");
      (checkRateLimit as any).mockResolvedValue(ok({ allowed: true }));

      await expect(applyIPRateLimit(mockConfig)).resolves.toBeUndefined();

      expect(getClientIpFromHeaders).toHaveBeenCalledTimes(1);
      expect(hashString).toHaveBeenCalledWith("192.168.1.1");
      expect(checkRateLimit).toHaveBeenCalledWith(mockConfig, "hashed-ip-123");
    });

    test("should propagate errors from getClientIdentifier", async () => {
      const mockConfig = {
        interval: 3600,
        allowedPerInterval: 100,
        namespace: "test:page",
      };

      (getClientIpFromHeaders as any).mockRejectedValue(new Error("IP fetch failed"));

      await expect(applyIPRateLimit(mockConfig)).rejects.toThrow("IP fetch failed");
    });

    test("should propagate rate limit exceeded errors", async () => {
      const mockConfig = {
        interval: 3600,
        allowedPerInterval: 100,
        namespace: "test:page",
      };

      (getClientIpFromHeaders as any).mockResolvedValue("192.168.1.1");
      (hashString as any).mockReturnValue("hashed-ip-123");
      (checkRateLimit as any).mockResolvedValue(ok({ allowed: false }));

      await expect(applyIPRateLimit(mockConfig)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );
    });
  });
});
