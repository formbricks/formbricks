import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { sendSsoSignInHintEmail } from "@/modules/email";
import { sendSsoSignInHint } from "./sso-sign-in-hint";

const mocks = vi.hoisted(() => ({ oidcDisplayName: { value: undefined as string | undefined } }));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/constants", () => ({
  get OIDC_DISPLAY_NAME() {
    return mocks.oidcDisplayName.value;
  },
}));

vi.mock("@/modules/email", () => ({
  sendSsoSignInHintEmail: vi.fn(),
}));

const user = { id: "user-1", email: "silvija@example.com", locale: "nl-NL" };

/** The provider names the one mail sent in this test carried. */
const mailedProviderNames = () => vi.mocked(sendSsoSignInHintEmail).mock.calls[0]?.[0].providerNames;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.oidcDisplayName.value = undefined;
  vi.mocked(sendSsoSignInHintEmail).mockResolvedValue(true);
});

describe("sendSsoSignInHint", () => {
  test("mails the provider names to the address on file, in the user's locale", async () => {
    await sendSsoSignInHint(user, ["azuread"]);

    expect(sendSsoSignInHintEmail).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      locale: user.locale,
      providerNames: ["Microsoft"],
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("uses the operator's OIDC display name, as the login button does", async () => {
    mocks.oidcDisplayName.value = "Acme SSO";

    await sendSsoSignInHint(user, ["openid"]);

    expect(mailedProviderNames()).toEqual(["Acme SSO"]);
  });

  test("calls an unnamed OIDC provider OpenID", async () => {
    await sendSsoSignInHint(user, ["openid"]);

    expect(mailedProviderNames()).toEqual(["OpenID"]);
  });

  test("names none when none is offered, so the mail points at the administrator", async () => {
    await sendSsoSignInHint(user, []);

    expect(mailedProviderNames()).toEqual([]);
  });

  test("lists a name once even when two providers display the same way", async () => {
    mocks.oidcDisplayName.value = "Microsoft";

    await sendSsoSignInHint(user, ["azuread", "openid"]);

    expect(mailedProviderNames()).toEqual(["Microsoft"]);
  });

  test("logs a send the mailer reports as undelivered", async () => {
    // An unconfigured mailer answers false rather than throwing, which would otherwise leave no trace.
    vi.mocked(sendSsoSignInHintEmail).mockResolvedValue(false);

    await sendSsoSignInHint(user, ["azuread"]);

    expect(logger.error).toHaveBeenCalledWith(
      { userId: user.id },
      "SSO sign-in hint email was not sent (mailer reported no delivery)"
    );
  });

  test("swallows and logs a failed send, since nothing after the response would catch it", async () => {
    const error = new Error("smtp down");
    vi.mocked(sendSsoSignInHintEmail).mockRejectedValue(error);

    await expect(sendSsoSignInHint(user, ["azuread"])).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      { err: error, userId: user.id },
      "Failed to send SSO sign-in hint email"
    );
  });
});
