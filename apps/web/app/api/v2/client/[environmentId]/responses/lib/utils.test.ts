import { extractIP } from "@/app/api/v2/client/[environmentId]/responses/lib/utils";
import { describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

// Helper function to create mock headers
function createMockHeaders(headerMap: Record<string, string | null>): Headers {
  const headersMap = new Map(Object.entries(headerMap));
  return {
    get: (key: string) => headersMap.get(key) || null,
  } as Headers;
}

describe("utils", () => {
  describe("extractIP", () => {
    const surveyId = "12345";

    test("should extract IP from x-forwarded-for header", () => {
      const mockHeaders = createMockHeaders({
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBe("192.168.1.1");
    });

    test("should extract IP from x-vercel-forwarded-for header", () => {
      const mockHeaders = createMockHeaders({
        "x-vercel-forwarded-for": "203.0.113.5",
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBe("203.0.113.5");
    });

    test("should extract IP from CF-Connecting-IP header", () => {
      const mockHeaders = createMockHeaders({
        "CF-Connecting-IP": "172.16.254.1",
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBe("172.16.254.1");
    });

    test("should extract IP from True-Client-IP header", () => {
      const mockHeaders = createMockHeaders({
        "True-Client-IP": "198.51.100.1",
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBe("198.51.100.1");
    });

    test("should prioritize x-forwarded-for over other headers", () => {
      const mockHeaders = createMockHeaders({
        "x-forwarded-for": "192.168.1.1",
        "x-vercel-forwarded-for": "203.0.113.5",
        "CF-Connecting-IP": "172.16.254.1",
        "True-Client-IP": "198.51.100.1",
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBe("192.168.1.1");
    });

    test("should return undefined for invalid IP address", () => {
      const mockHeaders = createMockHeaders({
        "x-forwarded-for": "invalid-ip",
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(`Not able to capture IP address for survey: ${surveyId}`);
    });

    test("should return undefined when no IP headers are present", () => {
      const mockHeaders = createMockHeaders({});
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(`Not able to capture IP address for survey: ${surveyId}`);
    });

    test("should handle null header values", () => {
      const mockHeaders = createMockHeaders({
        "x-forwarded-for": null,
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(`Not able to capture IP address for survey: ${surveyId}`);
    });

    test("should extract first IP from comma-separated list", () => {
      const mockHeaders = createMockHeaders({
        "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.254.1",
      });
      const ip = extractIP(mockHeaders, surveyId);
      expect(ip).toBe("192.168.1.1");
    });
  });
});
