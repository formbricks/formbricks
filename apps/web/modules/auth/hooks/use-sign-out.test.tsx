import { logSignOutAction } from "@/modules/auth/actions/sign-out";
import "@testing-library/jest-dom/vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { signOut } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

// Import the actual hook (unmock it for testing)
vi.unmock("@/modules/auth/hooks/use-sign-out");
const { useSignOut } = await import("./use-sign-out");

// Mock dependencies
vi.mock("@/modules/auth/actions/sign-out", () => ({
  logSignOutAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useSignOut", () => {
  const mockSessionUser = {
    id: "user-123",
    email: "test@example.com",
  };

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return signOut function", () => {
    const { result } = renderHook(() => useSignOut());

    expect(result.current.signOut).toBeDefined();
    expect(typeof result.current.signOut).toBe("function");
  });

  test("should sign out without audit logging when no session user", async () => {
    const { result } = renderHook(() => useSignOut());

    await result.current.signOut();

    expect(logSignOutAction).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({
      redirect: undefined,
      callbackUrl: undefined,
    });
  });

  test("should sign out with audit logging when session user exists", async () => {
    const { result } = renderHook(() => useSignOut(mockSessionUser));

    await result.current.signOut({
      reason: "user_initiated",
      redirectUrl: "/dashboard",
      organizationId: "org-123",
    });

    expect(logSignOutAction).toHaveBeenCalledWith("user-123", "test@example.com", {
      reason: "user_initiated",
      redirectUrl: "/dashboard",
      organizationId: "org-123",
    });

    expect(signOut).toHaveBeenCalledWith({
      redirect: undefined,
      callbackUrl: undefined,
    });
  });

  test("should handle null session user", async () => {
    const { result } = renderHook(() => useSignOut(null));

    await result.current.signOut();

    expect(logSignOutAction).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({
      redirect: undefined,
      callbackUrl: undefined,
    });
  });

  test("should use default reason when not provided", async () => {
    const { result } = renderHook(() => useSignOut(mockSessionUser));

    await result.current.signOut();

    expect(logSignOutAction).toHaveBeenCalledWith("user-123", "test@example.com", {
      reason: "user_initiated",
      redirectUrl: undefined,
      organizationId: undefined,
    });
  });

  test("should use callbackUrl as redirectUrl when redirectUrl not provided", async () => {
    const { result } = renderHook(() => useSignOut(mockSessionUser));

    await result.current.signOut({
      callbackUrl: "/auth/login",
      organizationId: "org-456",
    });

    expect(logSignOutAction).toHaveBeenCalledWith("user-123", "test@example.com", {
      reason: "user_initiated",
      redirectUrl: "/auth/login",
      organizationId: "org-456",
    });

    expect(signOut).toHaveBeenCalledWith({
      redirect: undefined,
      callbackUrl: "/auth/login",
    });
  });

  test("should pass through NextAuth signOut options", async () => {
    const { result } = renderHook(() => useSignOut(mockSessionUser));

    await result.current.signOut({
      redirect: false,
      callbackUrl: "/custom-redirect",
    });

    expect(signOut).toHaveBeenCalledWith({
      redirect: false,
      callbackUrl: "/custom-redirect",
    });
  });

  test("should handle different sign out reasons", async () => {
    const { result } = renderHook(() => useSignOut(mockSessionUser));

    const reasons = ["account_deletion", "email_change", "session_timeout", "forced_logout"] as const;

    for (const reason of reasons) {
      vi.clearAllMocks();

      await result.current.signOut({ reason });

      expect(logSignOutAction).toHaveBeenCalledWith("user-123", "test@example.com", {
        reason,
        redirectUrl: undefined,
        organizationId: undefined,
      });
    }
  });

  test("should handle session user without email", async () => {
    const userWithoutEmail = { id: "user-456" };
    const { result } = renderHook(() => useSignOut(userWithoutEmail));

    await result.current.signOut();

    expect(logSignOutAction).toHaveBeenCalledWith("user-456", "", {
      reason: "user_initiated",
      redirectUrl: undefined,
      organizationId: undefined,
    });
  });

  test("should not block sign out when audit logging fails", async () => {
    vi.mocked(logSignOutAction).mockRejectedValueOnce(new Error("Audit logging failed"));

    const { result } = renderHook(() => useSignOut(mockSessionUser));

    await result.current.signOut();

    expect(logger.error).toHaveBeenCalledWith("Failed to log signOut event:", expect.any(Error));

    expect(signOut).toHaveBeenCalledWith({
      redirect: undefined,
      callbackUrl: undefined,
    });
  });

  test("should return NextAuth signOut result", async () => {
    const mockSignOutResult = { url: "https://example.com/signed-out" };
    vi.mocked(signOut).mockResolvedValueOnce(mockSignOutResult);

    const { result } = renderHook(() => useSignOut(mockSessionUser));

    const signOutResult = await result.current.signOut();

    expect(signOutResult).toBe(mockSignOutResult);
  });

  test("should handle audit logging error and still return NextAuth result", async () => {
    const mockSignOutResult = { url: "https://example.com/signed-out" };
    vi.mocked(logSignOutAction).mockRejectedValueOnce(new Error("Network error"));
    vi.mocked(signOut).mockResolvedValueOnce(mockSignOutResult);

    const { result } = renderHook(() => useSignOut(mockSessionUser));

    const signOutResult = await result.current.signOut();

    expect(logger.error).toHaveBeenCalled();
    expect(signOutResult).toBe(mockSignOutResult);
  });

  test("should handle complex sign out scenario", async () => {
    const { result } = renderHook(() => useSignOut(mockSessionUser));

    await result.current.signOut({
      reason: "email_change",
      redirectUrl: "/profile/email-changed",
      organizationId: "org-complex-123",
      redirect: true,
      callbackUrl: "/dashboard",
    });

    expect(logSignOutAction).toHaveBeenCalledWith("user-123", "test@example.com", {
      reason: "email_change",
      redirectUrl: "/profile/email-changed", // redirectUrl takes precedence over callbackUrl
      organizationId: "org-complex-123",
    });

    expect(signOut).toHaveBeenCalledWith({
      redirect: true,
      callbackUrl: "/dashboard",
    });
  });

  test("should wait for audit logging before calling NextAuth signOut", async () => {
    let auditLogResolved = false;
    vi.mocked(logSignOutAction).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      auditLogResolved = true;
    });

    const { result } = renderHook(() => useSignOut(mockSessionUser));

    const signOutPromise = result.current.signOut();

    // NextAuth signOut should not be called immediately
    expect(signOut).not.toHaveBeenCalled();

    await signOutPromise;

    expect(auditLogResolved).toBe(true);
    expect(signOut).toHaveBeenCalled();
  });
});
