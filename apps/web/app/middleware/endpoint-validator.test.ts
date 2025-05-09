import { describe, expect, test } from "vitest";
import {
  isAuthProtectedRoute,
  isClientSideApiRoute,
  isForgotPasswordRoute,
  isLoginRoute,
  isManagementApiRoute,
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
      expect(isClientSideApiRoute("/api/packages/something")).toBe(true);
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
});
