import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPublicDomainHost, isPublicDomainConfigured, isRequestFromPublicDomain } from "./domain-utils";

// Mock the env module
vi.mock("@/lib/env", () => ({
  env: {
    get PUBLIC_URL() {
      return process.env.PUBLIC_URL || "";
    },
  },
}));

describe("Domain Utils", () => {
  beforeEach(() => {
    process.env.PUBLIC_URL = "";
  });

  describe("getPublicDomain", () => {
    test("should return null when PUBLIC_URL is empty", () => {
      expect(getPublicDomainHost()).toBeNull();
    });

    test("should return the host from a valid PUBLIC_URL", () => {
      process.env.PUBLIC_URL = "https://example.com";
      expect(getPublicDomainHost()).toBe("example.com");
    });

    test("should handle URLs with paths", () => {
      process.env.PUBLIC_URL = "https://example.com/path";
      expect(getPublicDomainHost()).toBe("example.com");
    });

    test("should handle URLs with ports", () => {
      process.env.PUBLIC_URL = "https://example.com:3000";
      expect(getPublicDomainHost()).toBe("example.com:3000");
    });
  });

  describe("isPublicDomainConfigured", () => {
    test("should return false when PUBLIC_URL is empty", () => {
      process.env.PUBLIC_URL = "";
      expect(isPublicDomainConfigured()).toBe(false);
    });

    test("should return true when PUBLIC_URL is valid", () => {
      process.env.PUBLIC_URL = "https://example.com";
      expect(isPublicDomainConfigured()).toBe(true);
    });
  });

  describe("isRequestFromPublicDomain", () => {
    test("should return false when public domain is not configured", () => {
      process.env.PUBLIC_URL = "";
      const request = new NextRequest("https://example.com");
      expect(isRequestFromPublicDomain(request)).toBe(false);
    });

    test("should return false when host doesn't match public domain", () => {
      process.env.PUBLIC_URL = "https://example.com";
      const request = new NextRequest("https://different-domain.com");
      expect(isRequestFromPublicDomain(request)).toBe(false);
    });

    test("should return true when host matches public domain", () => {
      process.env.PUBLIC_URL = "https://example.com";
      const request = new NextRequest("https://example.com", {
        headers: {
          host: "example.com",
        },
      });
      expect(isRequestFromPublicDomain(request)).toBe(true);
    });

    test("should handle domains with ports", () => {
      process.env.PUBLIC_URL = "https://example.com:3000";
      const request = new NextRequest("https://example.com:3000", {
        headers: {
          host: "example.com:3000",
        },
      });
      expect(isRequestFromPublicDomain(request)).toBe(true);
    });
  });
});
