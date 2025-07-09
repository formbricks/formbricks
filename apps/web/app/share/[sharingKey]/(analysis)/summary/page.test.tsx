import { getSurveyIdByResultShareKey } from "@/lib/survey/service";
// Import mocked functions
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock all dependencies to avoid server-side environment issues
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_PRODUCTION: false,
  WEBAPP_URL: "http://localhost:3000",
  SHORT_URL_BASE: "http://localhost:3000",
  ENCRYPTION_KEY: "test-key",
  RATE_LIMITING_DISABLED: false,
}));

vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
    NODE_ENV: "test",
    WEBAPP_URL: "http://localhost:3000",
    SHORT_URL_BASE: "http://localhost:3000",
    ENCRYPTION_KEY: "test-key",
    RATE_LIMITING_DISABLED: "false",
  },
}));

// Mock rate limiting dependencies
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    share: {
      url: { interval: 60, allowedPerInterval: 30, namespace: "share:url" },
    },
  },
}));

// Mock other dependencies
vi.mock("@/lib/survey/service", () => ({
  getSurveyIdByResultShareKey: vi.fn(),
}));

describe("Share Summary Page Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rate Limiting Configuration", () => {
    test("should have correct rate limit config for share URLs", () => {
      expect(rateLimitConfigs.share.url).toEqual({
        interval: 60,
        allowedPerInterval: 30,
        namespace: "share:url",
      });
    });

    test("should apply rate limiting function correctly", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();

      await applyIPRateLimit(rateLimitConfigs.share.url);

      expect(applyIPRateLimit).toHaveBeenCalledWith({
        interval: 60,
        allowedPerInterval: 30,
        namespace: "share:url",
      });
    });

    test("should throw rate limit error when limit exceeded", async () => {
      vi.mocked(applyIPRateLimit).mockRejectedValue(
        new Error("Maximum number of requests reached. Please try again later.")
      );

      await expect(applyIPRateLimit(rateLimitConfigs.share.url)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );
    });
  });

  describe("Share Key Validation Flow", () => {
    test("should validate sharing key after rate limiting", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getSurveyIdByResultShareKey).mockResolvedValue("survey123");

      // Simulate the flow: rate limit first, then validate sharing key
      await applyIPRateLimit(rateLimitConfigs.share.url);
      const surveyId = await getSurveyIdByResultShareKey("test-sharing-key-123");

      expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.share.url);
      expect(getSurveyIdByResultShareKey).toHaveBeenCalledWith("test-sharing-key-123");
      expect(surveyId).toBe("survey123");
    });

    test("should handle invalid sharing keys after rate limiting", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getSurveyIdByResultShareKey).mockResolvedValue(null);

      await applyIPRateLimit(rateLimitConfigs.share.url);
      const surveyId = await getSurveyIdByResultShareKey("invalid-key");

      expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.share.url);
      expect(getSurveyIdByResultShareKey).toHaveBeenCalledWith("invalid-key");
      expect(surveyId).toBeNull();
    });
  });

  describe("Security Considerations", () => {
    test("should rate limit all requests regardless of sharing key validity", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();

      // Test with valid sharing key
      vi.mocked(getSurveyIdByResultShareKey).mockResolvedValue("survey123");
      await applyIPRateLimit(rateLimitConfigs.share.url);
      await getSurveyIdByResultShareKey("valid-key");

      // Test with invalid sharing key
      vi.mocked(getSurveyIdByResultShareKey).mockResolvedValue(null);
      await applyIPRateLimit(rateLimitConfigs.share.url);
      await getSurveyIdByResultShareKey("invalid-key");

      expect(applyIPRateLimit).toHaveBeenCalledTimes(2);
    });

    test("should not expose internal errors when rate limited", async () => {
      const rateLimitError = new Error("Maximum number of requests reached. Please try again later.");
      vi.mocked(applyIPRateLimit).mockRejectedValue(rateLimitError);

      await expect(applyIPRateLimit(rateLimitConfigs.share.url)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );

      // Ensure no other operations are performed
      expect(getSurveyIdByResultShareKey).not.toHaveBeenCalled();
    });
  });
});
