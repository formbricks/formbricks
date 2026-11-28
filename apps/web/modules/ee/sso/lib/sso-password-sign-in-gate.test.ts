import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOfferedSsoProviders } from "./linked-sso-providers";
import { requireSsoSignInForSsoLinkedUser } from "./sso-password-sign-in-gate";

vi.mock("server-only", () => ({}));

vi.mock("./linked-sso-providers", () => ({ getOfferedSsoProviders: vi.fn() }));

vi.mock("@/lib/constants", () => ({ OIDC_DISPLAY_NAME: undefined }));

const linkedUser = { id: "user-1", identityProvider: "google" as const };

beforeEach(() => {
  vi.resetAllMocks();
  // The worst case for the path filter: the provider is offered, so only the path keeps the gate off.
  vi.mocked(getOfferedSsoProviders).mockResolvedValue(["google"]);
});

describe("requireSsoSignInForSsoLinkedUser", () => {
  test("refuses a password sign-in while a linked provider is offered", async () => {
    await expect(requireSsoSignInForSsoLinkedUser(linkedUser, "/sign-in/email")).rejects.toMatchObject({
      body: { code: "SSO_SIGN_IN_REQUIRED", providerNames: ["Google"] },
    });
  });

  // Every other way a session is created belongs to an SSO user signing in with SSO, or follows a password
  // step this check already passed. Refusing them would lock every licensed SSO user out of SSO itself.
  test.each([
    ["the SSO callback", "/callback/google"],
    ["the generic OAuth callback", "/oauth2/callback/openid"],
    ["the SSO recovery sign-in", "/sso-recovery/sign-in"],
    ["the two-factor verify after a password step", "/two-factor/verify-totp"],
    ["the email-verification auto sign-in", "/verify-email"],
    ["a session created outside any endpoint", undefined],
  ])("leaves %s alone", async (_label, path) => {
    await expect(requireSsoSignInForSsoLinkedUser(linkedUser, path)).resolves.toBeUndefined();
    expect(getOfferedSsoProviders).not.toHaveBeenCalled();
  });

  test("lets the password sign in while none of the user's providers is offered", async () => {
    vi.mocked(getOfferedSsoProviders).mockResolvedValue([]);

    await expect(requireSsoSignInForSsoLinkedUser(linkedUser, "/sign-in/email")).resolves.toBeUndefined();
  });

  test("fails closed when the provider lookup fails", async () => {
    vi.mocked(getOfferedSsoProviders).mockRejectedValue(new Error("db down"));

    await expect(requireSsoSignInForSsoLinkedUser(linkedUser, "/sign-in/email")).rejects.toThrow("db down");
  });
});
