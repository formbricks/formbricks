import { describe, expect, test } from "vitest";
import { isAdminDomainRoute, isPublicDomainRoute, isRouteAllowedForDomain } from "./endpoint-validator";

describe("domain routing", () => {
  describe("isPublicDomainRoute", () => {
    test("should allow health endpoint", () => {
      expect(isPublicDomainRoute("/health")).toBe(true);
    });

    test("should allow survey routes", () => {
      expect(isPublicDomainRoute("/s/survey123")).toBe(true);
      expect(isPublicDomainRoute("/s/survey-with-dashes")).toBe(true);
      expect(isPublicDomainRoute("/s/123-survey")).toBe(true);
    });

    test("should allow contact survey routes", () => {
      expect(isPublicDomainRoute("/c/jwt-token")).toBe(true);
      expect(isPublicDomainRoute("/c/very-long-jwt-token")).toBe(true);
    });

    test("should allow client API routes", () => {
      expect(isPublicDomainRoute("/api/v1/client/environments/123")).toBe(true);
      expect(isPublicDomainRoute("/api/v2/client/surveys/456")).toBe(true);
      expect(isPublicDomainRoute("/api/v1/client/storage/upload")).toBe(true);
    });

    test("should allow share routes", () => {
      expect(isPublicDomainRoute("/share/abc123/summary")).toBe(true);
      expect(isPublicDomainRoute("/share/xyz789/responses")).toBe(true);
      expect(isPublicDomainRoute("/share/anything/else")).toBe(true);
    });

    test("should block admin-only routes", () => {
      const adminOnlyRoutes = [
        "/",
        "/environments/123",
        "/auth/login",
        "/setup/organization",
        "/organizations/123",
        "/product/settings",
        "/api/v1/management/users",
        "/api/v2/management/surveys",
        "/pipeline/jobs",
        "/cron/tasks",
        "/random/route",
      ];

      adminOnlyRoutes.forEach((route) => {
        expect(isPublicDomainRoute(route)).toBe(false);
      });
    });
  });

  describe("isAdminDomainRoute", () => {
    test("should allow all routes when PUBLIC_URL not configured (backward compatibility)", () => {
      const allRoutes = [
        "/", // Root
        "/health", // Health
        "/environments/123", // Admin routes
        "/auth/login",
        "/setup/organization",
        "/organizations/123",
        "/product/settings",
        "/api/v1/management/users",
        "/api/v2/management/surveys",
        "/s/survey123", // Public routes also allowed for backward compatibility
        "/c/jwt-token",
        "/api/v1/client/test",
        "/share/abc/summary",
        "/pipeline/jobs", // Fallback routes
        "/cron/tasks",
        "/random/uncategorized/route",
      ];

      allRoutes.forEach((route) => {
        expect(isAdminDomainRoute(route, false)).toBe(true);
      });
    });

    test("should block public routes when PUBLIC_URL is configured", () => {
      // Health should still be allowed
      expect(isAdminDomainRoute("/health", true)).toBe(true);

      // Admin routes should be allowed
      const adminRoutes = [
        "/",
        "/environments/123",
        "/auth/login",
        "/setup/organization",
        "/organizations/123",
        "/product/settings",
        "/api/v1/management/users",
        "/api/v2/management/surveys",
        "/pipeline/jobs", // Fallback routes
        "/cron/tasks",
        "/random/route",
      ];

      adminRoutes.forEach((route) => {
        expect(isAdminDomainRoute(route, true)).toBe(true);
      });

      // Public routes should be blocked on admin domain
      const publicRoutes = [
        "/s/survey123",
        "/c/jwt-token",
        "/api/v1/client/test",
        "/api/v2/client/other",
        "/share/abc/summary",
      ];

      publicRoutes.forEach((route) => {
        expect(isAdminDomainRoute(route, true)).toBe(false);
      });
    });
  });

  describe("isRouteAllowedForDomain", () => {
    test("should enforce whitelist on public domain", () => {
      // Allowed routes
      const allowedPublicRoutes = [
        "/s/survey123",
        "/c/jwt-token",
        "/api/v1/client/test",
        "/api/v2/client/other",
        "/share/abc/summary",
        "/health",
      ];

      allowedPublicRoutes.forEach((route) => {
        expect(isRouteAllowedForDomain(route, true, true)).toBe(true);
      });

      // Blocked routes
      const blockedPublicRoutes = [
        "/",
        "/environments/123",
        "/auth/login",
        "/setup/organization",
        "/organizations/123",
        "/product/settings",
        "/api/v1/management/users",
        "/api/v2/management/surveys",
        "/pipeline/jobs",
        "/cron/tasks",
        "/random/route",
      ];

      blockedPublicRoutes.forEach((route) => {
        expect(isRouteAllowedForDomain(route, true, true)).toBe(false);
      });
    });

    test("should allow all routes on admin domain when PUBLIC_URL not configured", () => {
      const allRoutes = [
        "/",
        "/environments/123",
        "/auth/login",
        "/setup/organization",
        "/organizations/123",
        "/product/settings",
        "/api/v1/management/users",
        "/api/v2/management/surveys",
        "/s/survey123",
        "/c/jwt-token",
        "/api/v1/client/test",
        "/share/abc/summary",
        "/health",
        "/pipeline/jobs",
        "/cron/tasks",
        "/random/route",
      ];

      allRoutes.forEach((route) => {
        expect(isRouteAllowedForDomain(route, false, false)).toBe(true);
      });
    });

    test("should block public routes on admin domain when PUBLIC_URL is configured", () => {
      // Admin routes should be allowed
      const adminRoutes = [
        "/",
        "/environments/123",
        "/auth/login",
        "/setup/organization",
        "/organizations/123",
        "/product/settings",
        "/api/v1/management/users",
        "/api/v2/management/surveys",
        "/health",
        "/pipeline/jobs",
        "/cron/tasks",
        "/random/route",
      ];

      adminRoutes.forEach((route) => {
        expect(isRouteAllowedForDomain(route, false, true)).toBe(true);
      });

      // Public routes should be blocked on admin domain
      const publicRoutes = [
        "/s/survey123",
        "/c/jwt-token",
        "/api/v1/client/test",
        "/api/v2/client/other",
        "/share/abc/summary",
      ];

      publicRoutes.forEach((route) => {
        expect(isRouteAllowedForDomain(route, false, true)).toBe(false);
      });
    });
  });

  describe("edge cases", () => {
    test("should handle empty paths", () => {
      expect(isPublicDomainRoute("")).toBe(false);
      expect(isAdminDomainRoute("", false)).toBe(true);
      expect(isAdminDomainRoute("", true)).toBe(true);
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
