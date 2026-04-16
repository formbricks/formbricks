import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  completeSsoRecovery: vi.fn(),
  getSsoRecoveryFailureRedirectUrl: vi.fn(),
  verifySsoRelinkIntent: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/modules/ee/sso/lib/sso-recovery", () => ({
  completeSsoRecovery: mocks.completeSsoRecovery,
  getSsoRecoveryFailureRedirectUrl: mocks.getSsoRecoveryFailureRedirectUrl,
}));

vi.mock("@/lib/jwt", () => ({
  verifySsoRelinkIntent: mocks.verifySsoRelinkIntent,
}));

describe("SSO recovery completion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSsoRecoveryFailureRedirectUrl.mockReturnValue(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked"
    );
  });

  test("redirects to login when the intent token is missing", async () => {
    const response = await GET(new Request("http://localhost:3000/api/auth/sso/recovery/complete"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked"
    );
  });

  test("redirects to the original callback URL when recovery completes successfully", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user_1" } });
    mocks.completeSsoRecovery.mockResolvedValue("http://localhost:3000/invite?token=invite-token");

    const response = await GET(
      new Request("http://localhost:3000/api/auth/sso/recovery/complete?intent=test-intent")
    );

    expect(mocks.completeSsoRecovery).toHaveBeenCalledWith({
      intentToken: "test-intent",
      sessionUserId: "user_1",
    });
    expect(response.headers.get("location")).toBe("http://localhost:3000/invite?token=invite-token");
  });

  test("preserves the original callback URL on failure when the intent can still be verified", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user_1" } });
    mocks.completeSsoRecovery.mockRejectedValue(new Error("OAuthAccountNotLinked"));
    mocks.verifySsoRelinkIntent.mockReturnValue({
      callbackUrl: "http://localhost:3000/environments/env_1?foo=bar",
    });
    mocks.getSsoRecoveryFailureRedirectUrl.mockImplementation((callbackUrl?: string) =>
      callbackUrl
        ? `http://localhost:3000/auth/login?error=OAuthAccountNotLinked&callbackUrl=${encodeURIComponent(callbackUrl)}`
        : "http://localhost:3000/auth/login?error=OAuthAccountNotLinked"
    );

    const response = await GET(
      new Request("http://localhost:3000/api/auth/sso/recovery/complete?intent=test-intent")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fenvironments%2Fenv_1%3Ffoo%3Dbar"
    );
  });

  test("falls back to the generic login redirect when the intent is invalid", async () => {
    mocks.completeSsoRecovery.mockRejectedValue(new Error("OAuthAccountNotLinked"));
    mocks.verifySsoRelinkIntent.mockImplementation(() => {
      throw new Error("invalid");
    });

    const response = await GET(
      new Request("http://localhost:3000/api/auth/sso/recovery/complete?intent=invalid-intent")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked"
    );
  });
});
