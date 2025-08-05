import { describe, expect, test } from "vitest";
import {
  AuthenticationMethod,
  isAdminDomainRoute,
  isAuthProtectedRoute,
  isClientSideApiRoute,
  isIntegrationRoute,
  isManagementApiRoute,
  isPublicDomainRoute,
  isRouteAllowedForDomain,
  isSyncWithUserIdentificationEndpoint,
} from "./endpoint-validator";

describe("endpoint-validator", () => {
  describe("AuthenticationMethod enum", () => {
    test("should have correct values", () => {
      expect(AuthenticationMethod.ApiKey).toBe("apiKey");
      expect(AuthenticationMethod.Session).toBe("session");
      expect(AuthenticationMethod.Both).toBe("both");
      expect(AuthenticationMethod.None).toBe("none");
    });
  });
  describe("isClientSideApiRoute", () => {
    test("should return correct object for client-side API routes with rate limiting", () => {
      expect(isClientSideApiRoute("/api/v1/client/storage")).toEqual({
        isClientSideApi: true,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/v1/client/other")).toEqual({
        isClientSideApi: true,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/v2/client/other")).toEqual({
        isClientSideApi: true,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/v3/client/test")).toEqual({
        isClientSideApi: true,
        isRateLimited: true,
      });
    });

    test("should return correct object for OG route (client-side but not rate limited)", () => {
      expect(isClientSideApiRoute("/api/v1/client/og")).toEqual({
        isClientSideApi: true,
        isRateLimited: false,
      });
      expect(isClientSideApiRoute("/api/v1/client/og/image")).toEqual({
        isClientSideApi: true,
        isRateLimited: false,
      });
    });

    test("should return false for non-client-side API routes", () => {
      expect(isClientSideApiRoute("/api/v1/management/something")).toEqual({
        isClientSideApi: false,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/v1/js/actions")).toEqual({
        isClientSideApi: false,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/something")).toEqual({
        isClientSideApi: false,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/auth/login")).toEqual({
        isClientSideApi: false,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/v1/integrations/webhook")).toEqual({
        isClientSideApi: false,
        isRateLimited: true,
      });
    });

    test("should handle edge cases", () => {
      expect(isClientSideApiRoute("/api/v1/client")).toEqual({
        isClientSideApi: false,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/v1/client/")).toEqual({
        isClientSideApi: true,
        isRateLimited: true,
      });
      expect(isClientSideApiRoute("/api/client/test")).toEqual({
        isClientSideApi: false,
        isRateLimited: true,
      });
    });
  });

  describe("isManagementApiRoute", () => {
    test("should return correct object for management API routes with API key authentication", () => {
      expect(isManagementApiRoute("/api/v1/management/something")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v2/management/other")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v1/management/surveys")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v3/management/users")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
    });

    test("should return correct object for storage management routes with both authentication methods", () => {
      expect(isManagementApiRoute("/api/v1/management/storage")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.Both,
      });
      expect(isManagementApiRoute("/api/v1/management/storage/files")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.Both,
      });
      expect(isManagementApiRoute("/api/v1/management/storage/upload")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.Both,
      });
    });

    test("should return correct object for webhooks routes with API key authentication", () => {
      expect(isManagementApiRoute("/api/v1/webhooks")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v1/webhooks/123")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v1/webhooks/webhook-id/config")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
    });

    test("should return correct object for non-v1 storage management routes (only v1 supports both auth methods)", () => {
      expect(isManagementApiRoute("/api/v2/management/storage")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v3/management/storage/upload")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
    });

    test("should return correct object for non-v1 webhooks routes (falls back to management regex)", () => {
      expect(isManagementApiRoute("/api/v2/webhooks")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v3/webhooks/123")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v2/management/webhooks")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
    });

    test("should return correct object for non-management API routes", () => {
      expect(isManagementApiRoute("/api/v1/client/something")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/something")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/auth/login")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v1/integrations/webhook")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
    });

    test("should handle edge cases", () => {
      expect(isManagementApiRoute("/api/v1/management")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/v1/management/")).toEqual({
        isManagementApi: true,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/management/test")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
    });

    test("should handle webhooks edge cases", () => {
      expect(isManagementApiRoute("/api/v1/webhook")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/api/webhooks")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
      expect(isManagementApiRoute("/webhooks/api/v1")).toEqual({
        isManagementApi: false,
        authenticationMethod: AuthenticationMethod.ApiKey,
      });
    });
  });

  describe("isIntegrationRoute", () => {
    test("should return true for integration API routes", () => {
      expect(isIntegrationRoute("/api/v1/integrations/webhook")).toBe(true);
      expect(isIntegrationRoute("/api/v2/integrations/slack")).toBe(true);
      expect(isIntegrationRoute("/api/v1/integrations/zapier")).toBe(true);
      expect(isIntegrationRoute("/api/v3/integrations/other")).toBe(true);
    });

    test("should return false for non-integration API routes", () => {
      expect(isIntegrationRoute("/api/v1/client/something")).toBe(false);
      expect(isIntegrationRoute("/api/v1/management/something")).toBe(false);
      expect(isIntegrationRoute("/api/something")).toBe(false);
      expect(isIntegrationRoute("/auth/login")).toBe(false);
      expect(isIntegrationRoute("/integrations/webhook")).toBe(false);
    });

    test("should handle edge cases", () => {
      expect(isIntegrationRoute("/api/v1/integrations")).toBe(false);
      expect(isIntegrationRoute("/api/v1/integrations/")).toBe(true);
      expect(isIntegrationRoute("/api/integrations/test")).toBe(false);
    });
  });

  describe("isAuthProtectedRoute", () => {
    test("should return true for protected routes", () => {
      expect(isAuthProtectedRoute("/environments")).toBe(true);
      expect(isAuthProtectedRoute("/environments/something")).toBe(true);
      expect(isAuthProtectedRoute("/environments/123/surveys")).toBe(true);
      expect(isAuthProtectedRoute("/setup/organization")).toBe(true);
      expect(isAuthProtectedRoute("/setup/organization/create")).toBe(true);
      expect(isAuthProtectedRoute("/organizations")).toBe(true);
      expect(isAuthProtectedRoute("/organizations/something")).toBe(true);
      expect(isAuthProtectedRoute("/organizations/123/settings")).toBe(true);
    });

    test("should return false for non-protected routes", () => {
      expect(isAuthProtectedRoute("/auth/login")).toBe(false);
      expect(isAuthProtectedRoute("/auth/signup")).toBe(false);
      expect(isAuthProtectedRoute("/api/something")).toBe(false);
      expect(isAuthProtectedRoute("/api/v1/client/test")).toBe(false);
      expect(isAuthProtectedRoute("/")).toBe(false);
      expect(isAuthProtectedRoute("/s/survey123")).toBe(false);
      expect(isAuthProtectedRoute("/c/jwt-token")).toBe(false);
      expect(isAuthProtectedRoute("/health")).toBe(false);
    });

    test("should handle edge cases", () => {
      expect(isAuthProtectedRoute("/environment")).toBe(false); // partial match should not work
      expect(isAuthProtectedRoute("/organization")).toBe(false); // partial match should not work
      expect(isAuthProtectedRoute("/setup/team")).toBe(false); // not in protected routes
      expect(isAuthProtectedRoute("/setup")).toBe(false); // partial match should not work
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

      const result3 = isSyncWithUserIdentificationEndpoint(
        "/api/v1/client/env_123_test/app/sync/user_456_test"
      );
      expect(result3).toEqual({
        environmentId: "env_123_test",
        userId: "user_456_test",
      });
    });

    test("should handle optional trailing slash", () => {
      // Test both with and without trailing slash
      const result1 = isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/app/sync/user456");
      expect(result1).toEqual({
        environmentId: "env123",
        userId: "user456",
      });

      const result2 = isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/app/sync/user456/");
      expect(result2).toEqual({
        environmentId: "env123",
        userId: "user456",
      });
    });

    test("should return false for invalid sync URLs", () => {
      expect(isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/app/sync")).toBe(false);
      expect(isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/something")).toBe(false);
      expect(isSyncWithUserIdentificationEndpoint("/api/something")).toBe(false);
      expect(isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/app/other/user456")).toBe(false);
      expect(isSyncWithUserIdentificationEndpoint("/api/v2/client/env123/app/sync/user456")).toBe(false); // only v1 supported
    });

    test("should handle empty or malformed IDs", () => {
      expect(isSyncWithUserIdentificationEndpoint("/api/v1/client//app/sync/user456")).toBe(false);
      expect(isSyncWithUserIdentificationEndpoint("/api/v1/client/env123/app/sync/")).toBe(false);
    });
  });

  describe("isPublicDomainRoute", () => {
    test("should return true for health endpoint", () => {
      expect(isPublicDomainRoute("/health")).toBe(true);
    });

    test("should return true for public storage routes", () => {
      expect(isPublicDomainRoute("/storage/env123/public/file.jpg")).toBe(true);
      expect(isPublicDomainRoute("/storage/abc-456/public/document.pdf")).toBe(true);
      expect(isPublicDomainRoute("/storage/env123/public/folder/image.png")).toBe(true);
    });

    test("should return false for private storage routes", () => {
      expect(isPublicDomainRoute("/storage/env123/private/file.jpg")).toBe(false);
      expect(isPublicDomainRoute("/storage/env123")).toBe(false);
      expect(isPublicDomainRoute("/storage")).toBe(false);
    });

    // Static assets are not handled by domain routing - middleware doesn't run on them

    test("should return true for survey routes", () => {
      expect(isPublicDomainRoute("/s/survey123")).toBe(true);
      expect(isPublicDomainRoute("/s/survey-id-with-dashes")).toBe(true);
      expect(isPublicDomainRoute("/s/survey_id_with_underscores")).toBe(true);
      expect(isPublicDomainRoute("/s/abc123def456")).toBe(true);
    });

    test("should return false for malformed survey routes", () => {
      expect(isPublicDomainRoute("/s/")).toBe(false);
      expect(isPublicDomainRoute("/s")).toBe(false);
      expect(isPublicDomainRoute("/survey/123")).toBe(false);
    });

    test("should return true for contact survey routes", () => {
      expect(isPublicDomainRoute("/c/jwt-token")).toBe(true);
      expect(isPublicDomainRoute("/c/very-long-jwt-token-123")).toBe(true);
      expect(isPublicDomainRoute("/c/token.with.dots")).toBe(true);
    });

    test("should return false for malformed contact survey routes", () => {
      expect(isPublicDomainRoute("/c/")).toBe(false);
      expect(isPublicDomainRoute("/c")).toBe(false);
      expect(isPublicDomainRoute("/contact/token")).toBe(false);
    });

    test("should return true for client API routes", () => {
      expect(isPublicDomainRoute("/api/v1/client/something")).toBe(true);
      expect(isPublicDomainRoute("/api/v2/client/other")).toBe(true);
      expect(isPublicDomainRoute("/api/v1/client/env/actions")).toBe(true);
      expect(isPublicDomainRoute("/api/v2/client/env/responses")).toBe(true);
    });

    test("should return false for non-client API routes", () => {
      expect(isPublicDomainRoute("/api/v3/client/something")).toBe(false); // only v1 and v2 supported
      expect(isPublicDomainRoute("/api/client/something")).toBe(false);
      expect(isPublicDomainRoute("/api/v1/management/users")).toBe(false);
      expect(isPublicDomainRoute("/api/v1/integrations/webhook")).toBe(false);
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
    });

    test("should return true for public storage routes (backward compatibility)", () => {
      expect(isAdminDomainRoute("/storage/env123/public/file.jpg")).toBe(true);
      expect(isAdminDomainRoute("/storage/abc-456/public/document.pdf")).toBe(true);
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
      expect(isAdminDomainRoute("/api/v1/integrations/webhook")).toBe(true);
      expect(isAdminDomainRoute("/pipeline/jobs")).toBe(true);
      expect(isAdminDomainRoute("/cron/tasks")).toBe(true);
      expect(isAdminDomainRoute("/random/route")).toBe(true);
    });

    test("should return false for public-only routes", () => {
      expect(isAdminDomainRoute("/s/survey123")).toBe(false);
      expect(isAdminDomainRoute("/s/survey-id-with-dashes")).toBe(false);
      expect(isAdminDomainRoute("/c/jwt-token")).toBe(false);
      expect(isAdminDomainRoute("/c/very-long-jwt-token-123")).toBe(false);
      expect(isAdminDomainRoute("/api/v1/client/test")).toBe(false);
      expect(isAdminDomainRoute("/api/v2/client/other")).toBe(false);
    });

    test("should handle edge cases", () => {
      expect(isAdminDomainRoute("")).toBe(true);
      expect(isAdminDomainRoute("/unknown/path")).toBe(true); // unknown routes default to admin
    });
  });

  describe("isRouteAllowedForDomain", () => {
    describe("public domain routing", () => {
      test("should allow public routes on public domain", () => {
        expect(isRouteAllowedForDomain("/s/survey123", true)).toBe(true);
        expect(isRouteAllowedForDomain("/c/jwt-token", true)).toBe(true);
        expect(isRouteAllowedForDomain("/api/v1/client/test", true)).toBe(true);
        expect(isRouteAllowedForDomain("/api/v2/client/other", true)).toBe(true);
        expect(isRouteAllowedForDomain("/health", true)).toBe(true);
        expect(isRouteAllowedForDomain("/storage/env123/public/file.jpg", true)).toBe(true);
        // Static assets not tested - middleware doesn't run on them
      });

      test("should block admin routes on public domain", () => {
        expect(isRouteAllowedForDomain("/", true)).toBe(false);
        expect(isRouteAllowedForDomain("/environments/123", true)).toBe(false);
        expect(isRouteAllowedForDomain("/auth/login", true)).toBe(false);
        expect(isRouteAllowedForDomain("/api/v1/management/users", true)).toBe(false);
        expect(isRouteAllowedForDomain("/api/v1/integrations/webhook", true)).toBe(false);
        expect(isRouteAllowedForDomain("/organizations/123", true)).toBe(false);
        expect(isRouteAllowedForDomain("/setup/organization", true)).toBe(false);
      });
    });

    describe("admin domain routing", () => {
      test("should allow admin routes on admin domain", () => {
        expect(isRouteAllowedForDomain("/", false)).toBe(true);
        expect(isRouteAllowedForDomain("/environments/123", false)).toBe(true);
        expect(isRouteAllowedForDomain("/auth/login", false)).toBe(true);
        expect(isRouteAllowedForDomain("/api/v1/management/users", false)).toBe(true);
        expect(isRouteAllowedForDomain("/api/v1/integrations/webhook", false)).toBe(true);
        expect(isRouteAllowedForDomain("/health", false)).toBe(true);
        expect(isRouteAllowedForDomain("/storage/env123/public/file.jpg", false)).toBe(true);
        expect(isRouteAllowedForDomain("/pipeline/jobs", false)).toBe(true);
        expect(isRouteAllowedForDomain("/cron/tasks", false)).toBe(true);
        expect(isRouteAllowedForDomain("/unknown/route", false)).toBe(true);
      });

      test("should block public-only routes on admin domain when PUBLIC_URL is configured", () => {
        expect(isRouteAllowedForDomain("/s/survey123", false)).toBe(false);
        expect(isRouteAllowedForDomain("/s/survey-id-with-dashes", false)).toBe(false);
        expect(isRouteAllowedForDomain("/c/jwt-token", false)).toBe(false);
        expect(isRouteAllowedForDomain("/c/very-long-jwt-token-123", false)).toBe(false);
        expect(isRouteAllowedForDomain("/api/v1/client/test", false)).toBe(false);
        expect(isRouteAllowedForDomain("/api/v2/client/other", false)).toBe(false);
      });
    });

    describe("edge cases", () => {
      test("should handle empty paths", () => {
        expect(isRouteAllowedForDomain("", true)).toBe(false);
        expect(isRouteAllowedForDomain("", false)).toBe(true);
      });

      test("should handle paths with query parameters and fragments", () => {
        expect(isRouteAllowedForDomain("/s/survey123?param=value", true)).toBe(true);
        expect(isRouteAllowedForDomain("/s/survey123#section", true)).toBe(true);
        expect(isRouteAllowedForDomain("/environments/123?tab=settings", true)).toBe(false);
        expect(isRouteAllowedForDomain("/environments/123?tab=settings", false)).toBe(true);
      });
    });
  });

  describe("comprehensive integration tests", () => {
    describe("URL parsing edge cases", () => {
      test("should handle paths with query parameters", () => {
        expect(isPublicDomainRoute("/s/survey123?param=value&other=test")).toBe(true);
        expect(isPublicDomainRoute("/api/v1/client/test?query=data")).toBe(true);
        expect(isPublicDomainRoute("/environments/123?tab=settings")).toBe(false);
        expect(isAuthProtectedRoute("/environments/123?tab=overview")).toBe(true);
      });

      test("should handle paths with fragments", () => {
        expect(isPublicDomainRoute("/s/survey123#section")).toBe(true);
        expect(isPublicDomainRoute("/c/jwt-token#top")).toBe(true);
        expect(isPublicDomainRoute("/environments/123#overview")).toBe(false);
        expect(isAuthProtectedRoute("/organizations/456#settings")).toBe(true);
      });

      test("should handle trailing slashes", () => {
        expect(isPublicDomainRoute("/s/survey123/")).toBe(true);
        expect(isPublicDomainRoute("/api/v1/client/test/")).toBe(true);
        expect(isManagementApiRoute("/api/v1/management/test/")).toEqual({
          isManagementApi: true,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });
        expect(isIntegrationRoute("/api/v1/integrations/webhook/")).toBe(true);
      });
    });

    describe("nested route handling", () => {
      test("should handle nested survey routes", () => {
        expect(isPublicDomainRoute("/s/survey123/preview")).toBe(true);
        expect(isPublicDomainRoute("/s/survey123/embed")).toBe(true);
        expect(isPublicDomainRoute("/s/survey123/thank-you")).toBe(true);
      });

      test("should handle nested client API routes", () => {
        expect(isPublicDomainRoute("/api/v1/client/env123/actions")).toBe(true);
        expect(isPublicDomainRoute("/api/v2/client/env456/responses")).toBe(true);
        expect(isPublicDomainRoute("/api/v1/client/env789/surveys/123")).toBe(true);
        expect(isClientSideApiRoute("/api/v1/client/env123/actions")).toEqual({
          isClientSideApi: true,
          isRateLimited: true,
        });
      });

      test("should handle deeply nested admin routes", () => {
        expect(isAuthProtectedRoute("/environments/123/surveys/456/settings")).toBe(true);
        expect(isAuthProtectedRoute("/organizations/789/members/123/roles")).toBe(true);
        expect(isAuthProtectedRoute("/setup/organization/team/invites")).toBe(true);
      });
    });

    describe("version handling", () => {
      test("should handle different API versions correctly", () => {
        // Client API - only v1 and v2 supported in public routes
        expect(isPublicDomainRoute("/api/v1/client/test")).toBe(true);
        expect(isPublicDomainRoute("/api/v2/client/test")).toBe(true);
        expect(isPublicDomainRoute("/api/v3/client/test")).toBe(false);

        // Management API - all versions supported
        expect(isManagementApiRoute("/api/v1/management/test")).toEqual({
          isManagementApi: true,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });
        expect(isManagementApiRoute("/api/v2/management/test")).toEqual({
          isManagementApi: true,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });
        expect(isManagementApiRoute("/api/v3/management/test")).toEqual({
          isManagementApi: true,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });

        // Integration API - all versions supported
        expect(isIntegrationRoute("/api/v1/integrations/test")).toBe(true);
        expect(isIntegrationRoute("/api/v2/integrations/test")).toBe(true);
        expect(isIntegrationRoute("/api/v3/integrations/test")).toBe(true);
      });
    });

    describe("special characters in routes", () => {
      test("should handle special characters in survey IDs", () => {
        expect(isPublicDomainRoute("/s/survey-123_test.v2")).toBe(true);
        expect(isPublicDomainRoute("/c/jwt.token.with.dots")).toBe(true);
        expect(
          isSyncWithUserIdentificationEndpoint("/api/v1/client/env-123_test/app/sync/user-456_test")
        ).toEqual({
          environmentId: "env-123_test",
          userId: "user-456_test",
        });
      });
    });

    describe("security considerations", () => {
      test("should properly validate malicious or injection-like URLs", () => {
        // SQL injection-like attempts
        expect(isPublicDomainRoute("/s/'; DROP TABLE users; --")).toBe(true); // Still valid survey ID format
        expect(isManagementApiRoute("/api/v1/management/'; DROP TABLE users; --")).toEqual({
          isManagementApi: true,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });

        // Path traversal attempts
        expect(isPublicDomainRoute("/s/../../../etc/passwd")).toBe(true); // Still matches pattern
        expect(isAuthProtectedRoute("/environments/../../../etc/passwd")).toBe(true);

        // XSS-like attempts
        expect(isPublicDomainRoute("/s/<script>alert('xss')</script>")).toBe(true);
        expect(isClientSideApiRoute("/api/v1/client/<script>alert('xss')</script>")).toEqual({
          isClientSideApi: true,
          isRateLimited: true,
        });
      });

      test("should handle URL encoding", () => {
        expect(isPublicDomainRoute("/s/survey%20123")).toBe(true);
        expect(isPublicDomainRoute("/c/jwt%2Etoken")).toBe(true);
        expect(isAuthProtectedRoute("/environments%2F123")).toBe(true);
        expect(isManagementApiRoute("/api/v1/management/test%20route")).toEqual({
          isManagementApi: true,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });
      });
    });

    describe("performance considerations", () => {
      test("should handle very long URLs efficiently", () => {
        const longSurveyId = "a".repeat(1000);
        const longPath = `s/${longSurveyId}`;
        expect(isPublicDomainRoute(`/${longPath}`)).toBe(true);

        const longEnvironmentId = "env" + "a".repeat(1000);
        const longUserId = "user" + "b".repeat(1000);
        expect(
          isSyncWithUserIdentificationEndpoint(`/api/v1/client/${longEnvironmentId}/app/sync/${longUserId}`)
        ).toEqual({
          environmentId: longEnvironmentId,
          userId: longUserId,
        });
      });

      test("should handle empty and minimal inputs", () => {
        expect(isPublicDomainRoute("")).toBe(false);
        expect(isClientSideApiRoute("")).toEqual({
          isClientSideApi: false,
          isRateLimited: true,
        });
        expect(isManagementApiRoute("")).toEqual({
          isManagementApi: false,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });
        expect(isIntegrationRoute("")).toBe(false);
        expect(isAuthProtectedRoute("")).toBe(false);
        expect(isSyncWithUserIdentificationEndpoint("")).toBe(false);
      });
    });

    describe("case sensitivity", () => {
      test("should be case sensitive for route patterns", () => {
        // These should not match due to case sensitivity
        expect(isPublicDomainRoute("/S/survey123")).toBe(false);
        expect(isPublicDomainRoute("/C/jwt-token")).toBe(false);
        expect(isClientSideApiRoute("/API/V1/CLIENT/test")).toEqual({
          isClientSideApi: false,
          isRateLimited: true,
        });
        expect(isManagementApiRoute("/API/V1/MANAGEMENT/test")).toEqual({
          isManagementApi: false,
          authenticationMethod: AuthenticationMethod.ApiKey,
        });
        expect(isIntegrationRoute("/API/V1/INTEGRATIONS/test")).toBe(false);
        expect(isAuthProtectedRoute("/ENVIRONMENTS/123")).toBe(false);
      });
    });
  });
});
