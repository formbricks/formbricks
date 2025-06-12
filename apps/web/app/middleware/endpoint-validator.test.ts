import { describe, expect, test } from "vitest";
import {
  isAdminDomainRoute,
  isAuthProtectedRoute,
  isClientSideApiRoute,
  isForgotPasswordRoute,
  isLoginRoute,
  isManagementApiRoute,
  isPublicDomainRoute,
  isRouteAllowedForDomain,
  isShareUrlRoute,
  isSignupRoute,
  isSyncWithUserIdentificationEndpoint,
  isVerifyEmailRoute,
} from "./endpoint-validator";

describe("endpoint-validator", () => {
  describe("isLoginRoute", () => {
    test("should return true for login routes", () => {
      expect(isLoginRoute("/api/auth/callback/credentials")).toBe(true);
      expect(isLoginRoute("/auth/login")).toBe(true);
    });

    test("should return false for non-login routes", () => {
      expect(isLoginRoute("/auth/signup")).toBe(false);
      expect(isLoginRoute("/api/something")).toBe(false);
    });
  });

  describe("isSignupRoute", () => {
    test("should return true for signup route", () => {
      expect(isSignupRoute("/auth/signup")).toBe(true);
    });

    test("should return false for non-signup routes", () => {
      expect(isSignupRoute("/auth/login")).toBe(false);
      expect(isSignupRoute("/api/something")).toBe(false);
    });
  });

  describe("isVerifyEmailRoute", () => {
    test("should return true for verify email route", () => {
      expect(isVerifyEmailRoute("/auth/verify-email")).toBe(true);
    });

    test("should return false for non-verify email routes", () => {
      expect(isVerifyEmailRoute("/auth/login")).toBe(false);
      expect(isVerifyEmailRoute("/api/something")).toBe(false);
    });
  });

  describe("isForgotPasswordRoute", () => {
    test("should return true for forgot password route", () => {
      expect(isForgotPasswordRoute("/auth/forgot-password")).toBe(true);
    });

    test("should return false for non-forgot password routes", () => {
      expect(isForgotPasswordRoute("/auth/login")).toBe(false);
      expect(isForgotPasswordRoute("/api/something")).toBe(false);
    });
  });

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

  describe("isShareUrlRoute", () => {
    test("should return true for share URL routes", () => {
      expect(isShareUrlRoute("/share/abc123/summary")).toBe(true);
      expect(isShareUrlRoute("/share/abc123/responses")).toBe(true);
      expect(isShareUrlRoute("/share/abc123def456/summary")).toBe(true);
    });

    test("should return false for non-share URL routes", () => {
      expect(isShareUrlRoute("/share/abc123")).toBe(false);
      expect(isShareUrlRoute("/share/abc123/other")).toBe(false);
      expect(isShareUrlRoute("/api/something")).toBe(false);
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

  // Static assets are handled by middleware matcher and don't need explicit route checking

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
      expect(isAdminDomainRoute("/health", false)).toBe(true);
      expect(isAdminDomainRoute("/health", true)).toBe(true);
    });

    // Static assets are not handled by domain routing - middleware doesn't run on them

    test("should return true for admin routes when PUBLIC_URL not configured", () => {
      expect(isAdminDomainRoute("/", false)).toBe(true);
      expect(isAdminDomainRoute("/environments/123", false)).toBe(true);
      expect(isAdminDomainRoute("/environments/123/surveys", false)).toBe(true);
      expect(isAdminDomainRoute("/auth/login", false)).toBe(true);
      expect(isAdminDomainRoute("/auth/signup", false)).toBe(true);
      expect(isAdminDomainRoute("/setup/organization", false)).toBe(true);
      expect(isAdminDomainRoute("/setup/team", false)).toBe(true);
      expect(isAdminDomainRoute("/organizations/123", false)).toBe(true);
      expect(isAdminDomainRoute("/organizations/123/settings", false)).toBe(true);
      expect(isAdminDomainRoute("/product/settings", false)).toBe(true);
      expect(isAdminDomainRoute("/product/features", false)).toBe(true);
      expect(isAdminDomainRoute("/api/v1/management/users", false)).toBe(true);
      expect(isAdminDomainRoute("/api/v2/management/surveys", false)).toBe(true);
      expect(isAdminDomainRoute("/pipeline/jobs", false)).toBe(true);
      expect(isAdminDomainRoute("/cron/tasks", false)).toBe(true);
      expect(isAdminDomainRoute("/random/route", false)).toBe(true);
      // Public routes also allowed for backward compatibility
      expect(isAdminDomainRoute("/s/survey123", false)).toBe(true);
      expect(isAdminDomainRoute("/c/jwt-token", false)).toBe(true);
      expect(isAdminDomainRoute("/api/v1/client/test", false)).toBe(true);
    });

    test("should block public routes when PUBLIC_URL is configured", () => {
      // Admin routes should be allowed
      expect(isAdminDomainRoute("/", true)).toBe(true);
      expect(isAdminDomainRoute("/environments/123", true)).toBe(true);
      expect(isAdminDomainRoute("/auth/login", true)).toBe(true);
      expect(isAdminDomainRoute("/setup/organization", true)).toBe(true);
      expect(isAdminDomainRoute("/organizations/123", true)).toBe(true);
      expect(isAdminDomainRoute("/product/settings", true)).toBe(true);
      expect(isAdminDomainRoute("/api/v1/management/users", true)).toBe(true);
      expect(isAdminDomainRoute("/api/v2/management/surveys", true)).toBe(true);
      expect(isAdminDomainRoute("/pipeline/jobs", true)).toBe(true);
      expect(isAdminDomainRoute("/cron/tasks", true)).toBe(true);
      expect(isAdminDomainRoute("/random/route", true)).toBe(true);

      // Public routes should be blocked on admin domain
      expect(isAdminDomainRoute("/s/survey123", true)).toBe(false);
      expect(isAdminDomainRoute("/c/jwt-token", true)).toBe(false);
      expect(isAdminDomainRoute("/api/v1/client/test", true)).toBe(false);
      expect(isAdminDomainRoute("/share/abc/summary", true)).toBe(false);
    });
  });

  describe("isRouteAllowedForDomain", () => {
    test("should allow public routes on public domain", () => {
      expect(isRouteAllowedForDomain("/s/survey123", true, true)).toBe(true);
      expect(isRouteAllowedForDomain("/c/jwt-token", true, true)).toBe(true);
      expect(isRouteAllowedForDomain("/api/v1/client/test", true, true)).toBe(true);
      expect(isRouteAllowedForDomain("/share/abc/summary", true, true)).toBe(true);
      expect(isRouteAllowedForDomain("/health", true, true)).toBe(true);
      // Static assets not tested - middleware doesn't run on them
    });

    test("should block admin routes on public domain", () => {
      expect(isRouteAllowedForDomain("/", true, true)).toBe(false);
      expect(isRouteAllowedForDomain("/environments/123", true, true)).toBe(false);
      expect(isRouteAllowedForDomain("/auth/login", true, true)).toBe(false);
      expect(isRouteAllowedForDomain("/api/v1/management/users", true, true)).toBe(false);
    });

    test("should allow all routes on admin domain when PUBLIC_URL not configured", () => {
      expect(isRouteAllowedForDomain("/", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/environments/123", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/auth/login", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/api/v1/management/users", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/s/survey123", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/c/jwt-token", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/api/v1/client/test", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/health", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/pipeline/jobs", false, false)).toBe(true);
      expect(isRouteAllowedForDomain("/cron/tasks", false, false)).toBe(true);
    });

    test("should block public routes on admin domain when PUBLIC_URL is configured", () => {
      // Admin routes should be allowed
      expect(isRouteAllowedForDomain("/", false, true)).toBe(true);
      expect(isRouteAllowedForDomain("/environments/123", false, true)).toBe(true);
      expect(isRouteAllowedForDomain("/auth/login", false, true)).toBe(true);
      expect(isRouteAllowedForDomain("/api/v1/management/users", false, true)).toBe(true);
      expect(isRouteAllowedForDomain("/health", false, true)).toBe(true);
      expect(isRouteAllowedForDomain("/pipeline/jobs", false, true)).toBe(true);
      expect(isRouteAllowedForDomain("/cron/tasks", false, true)).toBe(true);

      // Public routes should be blocked on admin domain
      expect(isRouteAllowedForDomain("/s/survey123", false, true)).toBe(false);
      expect(isRouteAllowedForDomain("/c/jwt-token", false, true)).toBe(false);
      expect(isRouteAllowedForDomain("/api/v1/client/test", false, true)).toBe(false);
      expect(isRouteAllowedForDomain("/share/abc/summary", false, true)).toBe(false);
    });
  });
});
