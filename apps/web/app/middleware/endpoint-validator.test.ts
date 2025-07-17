import { describe, expect, test } from "vitest";
import {
  isAdminDomainRoute,
  isAuthProtectedRoute,
  isClientSideApiRoute,
  isManagementApiRoute,
  isPublicDomainRoute,
  isRouteAllowedForDomain,
  isSyncWithUserIdentificationEndpoint,
} from "./endpoint-validator";

describe("endpoint-validator", () => {
  describe("isClientSideApiRoute", () => {
    test("should return true for client-side API routes", () => {
      expect(isClientSideApiRoute("/api/v1/js/actions")).toBe(true);
      expect(isClientSideApiRoute("/api/v1/client/storage")).toBe(true);
      expect(isClientSideApiRoute("/api/v1/client/other")).toBe(true);
      expect(isClientSideApiRoute("/api/v2/client/other")).toBe(true);
    });

    test("should return false for non-client-side API routes", () => {
      expect(isClientSideApiRoute("/api/v1/management/something")).toBe(false);
      expect(isClientSideApiRoute("/api/something")).toBe(false);
      expect(isClientSideApiRoute("/auth/login")).toBe(false);

      // exception for open graph image generation route, it should not be rate limited
      expect(isClientSideApiRoute("/api/v1/client/og")).toBe(false);
    });
  });

  describe("isManagementApiRoute", () => {
    test("should return true for management API routes", () => {
      expect(isManagementApiRoute("/api/v1/management/something")).toBe(true);
      expect(isManagementApiRoute("/api/v2/management/other")).toBe(true);
    });

    test("should return false for non-management API routes", () => {
      expect(isManagementApiRoute("/api/v1/client/something")).toBe(false);
      expect(isManagementApiRoute("/api/something")).toBe(false);
      expect(isManagementApiRoute("/auth/login")).toBe(false);
    });
  });

  describe("isAuthProtectedRoute", () => {
    test("should return true for protected routes", () => {
      expect(isAuthProtectedRoute("/environments")).toBe(true);
      expect(isAuthProtectedRoute("/environments/something")).toBe(true);
      expect(isAuthProtectedRoute("/setup/organization")).toBe(true);
      expect(isAuthProtectedRoute("/organizations")).toBe(true);
      expect(isAuthProtectedRoute("/organizations/something")).toBe(true);
    });

    test("should return false for non-protected routes", () => {
      expect(isAuthProtectedRoute("/auth/login")).toBe(false);
      expect(isAuthProtectedRoute("/api/something")).toBe(false);
      expect(isAuthProtectedRoute("/")).toBe(false);
    });
  });

  describe("isSyncWithUserIdentificationEndpoint", () => {
    test("should return environmentId and userId for valid sync URLs", () => {
      const result1 = isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/app/sync/user456");
      expect(result1).toEqual({
        environmentId: "env123",
        userId: "user456",
      });

      const result2 = isSyncWithUserIdentificationEndpoint("/api/v1/client/abc-123/app/sync/xyz-789");
      expect(result2).toEqual({
        environmentId: "abc-123",
        userId: "xyz-789",
      });
    });

    test("should return false for invalid sync URLs", () => {
      expect(isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/app/sync")).toBe(false);
      expect(isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/something")).toBe(false);
      expect(isSyncWithUserIdentificationEndpoint("/api/something")).toBe(false);
    });
  });

  describe("isPublicDomainRoute", () => {
    test("should return true for health endpoint", () => {
      expect(isPublicDomainRoute("/health")).toBe(true);
    });

    // Static assets are not handled by domain routing - middleware doesn't run on them

    test("should return true for survey routes", () => {
      expect(isPublicDomainRoute("/s/survey123")).toBe(true);
      expect(isPublicDomainRoute("/s/survey-id-with-dashes")).toBe(true);
    });

    test("should return true for contact survey routes", () => {
      expect(isPublicDomainRoute("/c/jwt-token")).toBe(true);
      expect(isPublicDomainRoute("/c/very-long-jwt-token-123")).toBe(true);
    });

    test("should return true for client API routes", () => {
      expect(isPublicDomainRoute("/api/v1/client/something")).toBe(true);
      expect(isPublicDomainRoute("/api/v2/client/other")).toBe(true);
    });

    test("should return true for share routes", () => {
      expect(isPublicDomainRoute("/share/abc123/summary")).toBe(true);
      expect(isPublicDomainRoute("/share/xyz789/responses")).toBe(true);
      expect(isPublicDomainRoute("/share/anything")).toBe(true);
    });

    test("should return false for admin-only routes", () => {
      expect(isPublicDomainRoute("/")).toBe(false);
      expect(isPublicDomainRoute("/environments/123")).toBe(false);
      expect(isPublicDomainRoute("/auth/login")).toBe(false);
      expect(isPublicDomainRoute("/setup/organization")).toBe(false);
      expect(isPublicDomainRoute("/organizations/123")).toBe(false);
      expect(isPublicDomainRoute("/product/settings")).toBe(false);
      expect(isPublicDomainRoute("/api/v1/management/users")).toBe(false);
      expect(isPublicDomainRoute("/api/v2/management/surveys")).toBe(false);
    });
  });

  describe("isAdminDomainRoute", () => {
    test("should return true for health endpoint (backward compatibility)", () => {
      expect(isAdminDomainRoute("/health")).toBe(true);
      expect(isAdminDomainRoute("/health")).toBe(true);
    });

    // Static assets are not handled by domain routing - middleware doesn't run on them

    test("should return true for admin routes", () => {
      expect(isAdminDomainRoute("/")).toBe(true);
      expect(isAdminDomainRoute("/environments/123")).toBe(true);
      expect(isAdminDomainRoute("/environments/123/surveys")).toBe(true);
      expect(isAdminDomainRoute("/auth/login")).toBe(true);
      expect(isAdminDomainRoute("/auth/signup")).toBe(true);
      expect(isAdminDomainRoute("/setup/organization")).toBe(true);
      expect(isAdminDomainRoute("/setup/team")).toBe(true);
      expect(isAdminDomainRoute("/organizations/123")).toBe(true);
      expect(isAdminDomainRoute("/organizations/123/settings")).toBe(true);
      expect(isAdminDomainRoute("/product/settings")).toBe(true);
      expect(isAdminDomainRoute("/product/features")).toBe(true);
      expect(isAdminDomainRoute("/api/v1/management/users")).toBe(true);
      expect(isAdminDomainRoute("/api/v2/management/surveys")).toBe(true);
      expect(isAdminDomainRoute("/pipeline/jobs")).toBe(true);
      expect(isAdminDomainRoute("/cron/tasks")).toBe(true);
      expect(isAdminDomainRoute("/random/route")).toBe(true);
      expect(isAdminDomainRoute("/s/survey123")).toBe(false);
      expect(isAdminDomainRoute("/c/jwt-token")).toBe(false);
      expect(isAdminDomainRoute("/api/v1/client/test")).toBe(false);
    });
  });

  describe("isRouteAllowedForDomain", () => {
    test("should allow public routes on public domain", () => {
      expect(isRouteAllowedForDomain("/s/survey123", true)).toBe(true);
      expect(isRouteAllowedForDomain("/c/jwt-token", true)).toBe(true);
      expect(isRouteAllowedForDomain("/api/v1/client/test", true)).toBe(true);
      expect(isRouteAllowedForDomain("/share/abc/summary", true)).toBe(true);
      expect(isRouteAllowedForDomain("/health", true)).toBe(true);
      // Static assets not tested - middleware doesn't run on them
    });

    test("should block admin routes on public domain", () => {
      expect(isRouteAllowedForDomain("/", true)).toBe(false);
      expect(isRouteAllowedForDomain("/environments/123", true)).toBe(false);
      expect(isRouteAllowedForDomain("/auth/login", true)).toBe(false);
      expect(isRouteAllowedForDomain("/api/v1/management/users", true)).toBe(false);
    });

    test("should block public routes on admin domain when PUBLIC_URL is configured", () => {
      // Admin routes should be allowed
      expect(isRouteAllowedForDomain("/", false)).toBe(true);
      expect(isRouteAllowedForDomain("/environments/123", false)).toBe(true);
      expect(isRouteAllowedForDomain("/auth/login", false)).toBe(true);
      expect(isRouteAllowedForDomain("/api/v1/management/users", false)).toBe(true);
      expect(isRouteAllowedForDomain("/health", false)).toBe(true);
      expect(isRouteAllowedForDomain("/pipeline/jobs", false)).toBe(true);
      expect(isRouteAllowedForDomain("/cron/tasks", false)).toBe(true);

      // Public routes should be blocked on admin domain
      expect(isRouteAllowedForDomain("/s/survey123", false)).toBe(false);
      expect(isRouteAllowedForDomain("/c/jwt-token", false)).toBe(false);
      expect(isRouteAllowedForDomain("/api/v1/client/test", false)).toBe(false);
      expect(isRouteAllowedForDomain("/share/abc/summary", false)).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("should handle empty paths", () => {
      expect(isPublicDomainRoute("")).toBe(false);
      expect(isAdminDomainRoute("")).toBe(true);
      expect(isAdminDomainRoute("")).toBe(true);
    });

    test("should handle paths with query parameters", () => {
      expect(isPublicDomainRoute("/s/survey123?param=value")).toBe(true);
      expect(isPublicDomainRoute("/environments/123?tab=settings")).toBe(false);
    });

    test("should handle paths with fragments", () => {
      expect(isPublicDomainRoute("/s/survey123#section")).toBe(true);
      expect(isPublicDomainRoute("/environments/123#overview")).toBe(false);
    });

    test("should handle nested survey routes", () => {
      expect(isPublicDomainRoute("/s/survey123/preview")).toBe(true);
      expect(isPublicDomainRoute("/s/survey123/embed")).toBe(true);
    });

    test("should handle nested client API routes", () => {
      expect(isPublicDomainRoute("/api/v1/client/env123/actions")).toBe(true);
      expect(isPublicDomainRoute("/api/v2/client/env456/responses")).toBe(true);
    });
  });
});
