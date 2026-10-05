import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TSsoIdentityProvider } from "@/modules/ee/sso/lib/provider-normalization";
import { getSsoAvailability } from "@/modules/ee/sso/lib/sso-availability";
import { sendSsoSignInHintEmail } from "@/modules/email";
import { getLinkedSsoProviders, sendSsoSignInHint } from "./sso-sign-in-hint";

const mocks = vi.hoisted(() => ({ oidcDisplayName: { value: undefined as string | undefined } }));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { account: { findMany: vi.fn() } },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/constants", () => ({
  get OIDC_DISPLAY_NAME() {
    return mocks.oidcDisplayName.value;
  },
}));

vi.mock("@/modules/ee/sso/lib/sso-availability", () => ({
  getSsoAvailability: vi.fn(),
}));

vi.mock("@/modules/email", () => ({
  sendSsoSignInHintEmail: vi.fn(),
}));

const ALL_PROVIDERS: TSsoIdentityProvider[] = ["google", "github", "azuread", "openid", "saml"];

const user = {
  id: "user-1",
  email: "silvija@example.com",
  locale: "nl-NL",
  isActive: true,
  identityProvider: "azuread" as const,
};

const linkAccounts = (...providers: string[]) =>
  vi.mocked(prisma.account.findMany).mockResolvedValue(
    // Only `provider` is selected, so that is all a row carries here.
    providers.map((provider) => ({ provider })) as unknown as Awaited<
      ReturnType<typeof prisma.account.findMany>
    >
  );

const offerOnLoginPage = (...offered: TSsoIdentityProvider[]) =>
  vi.mocked(getSsoAvailability).mockResolvedValue({
    isSsoEnabled: offered.length > 0,
    providers: Object.fromEntries(ALL_PROVIDERS.map((p) => [p, offered.includes(p)])) as Record<
      TSsoIdentityProvider,
      boolean
    >,
  });

/** The provider names the one mail sent in this test carried. */
const mailedProviderNames = () => vi.mocked(sendSsoSignInHintEmail).mock.calls[0]?.[0].providerNames;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.oidcDisplayName.value = undefined;
  linkAccounts();
  offerOnLoginPage(...ALL_PROVIDERS);
  vi.mocked(sendSsoSignInHintEmail).mockResolvedValue(true);
});

describe("getLinkedSsoProviders", () => {
  test("reads only this user's non-credential accounts", async () => {
    await getLinkedSsoProviders(user);

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { userId: user.id, provider: { not: "credential" } },
      select: { provider: true },
    });
  });

  test("lists every linked provider once, the one the account was created with first", async () => {
    // `azure-ad` is the NextAuth-era spelling of the same provider still found on old rows.
    linkAccounts("google", "azure-ad", "azuread");

    expect(await getLinkedSsoProviders(user)).toEqual(["azuread", "google"]);
  });

  test("falls back to the identity provider when no SSO account row is linked", async () => {
    expect(await getLinkedSsoProviders({ ...user, identityProvider: "github" })).toEqual(["github"]);
  });

  test("drops provider ids it cannot name instead of showing them raw", async () => {
    linkAccounts("some-legacy-provider");

    expect(await getLinkedSsoProviders(user)).toEqual(["azuread"]);
  });
});

describe("sendSsoSignInHint", () => {
  test("mails the provider names to the address on file, in the user's locale", async () => {
    await sendSsoSignInHint(user);

    expect(sendSsoSignInHintEmail).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      locale: user.locale,
      providerNames: ["Microsoft"],
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("uses the operator's OIDC display name, as the login button does", async () => {
    mocks.oidcDisplayName.value = "Acme SSO";

    await sendSsoSignInHint({ ...user, identityProvider: "openid" });

    expect(mailedProviderNames()).toEqual(["Acme SSO"]);
  });

  test("calls an unnamed OIDC provider OpenID", async () => {
    await sendSsoSignInHint({ ...user, identityProvider: "openid" });

    expect(mailedProviderNames()).toEqual(["OpenID"]);
  });

  test("names only the providers the login page currently offers", async () => {
    linkAccounts("google", "github");
    offerOnLoginPage("github");

    await sendSsoSignInHint({ ...user, identityProvider: "google" });

    expect(mailedProviderNames()).toEqual(["GitHub"]);
  });

  test("names none when the login page offers none of them, so the mail points at the administrator", async () => {
    offerOnLoginPage();

    await sendSsoSignInHint(user);

    expect(mailedProviderNames()).toEqual([]);
  });

  test("lists a name once even when two providers display the same way", async () => {
    mocks.oidcDisplayName.value = "Microsoft";
    linkAccounts("openid");

    await sendSsoSignInHint(user);

    expect(mailedProviderNames()).toEqual(["Microsoft"]);
  });

  test("mails nothing to a deactivated user, who cannot sign in by any route", async () => {
    await sendSsoSignInHint({ ...user, isActive: false });

    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
    expect(prisma.account.findMany).not.toHaveBeenCalled();
  });

  test("logs a send the mailer reports as undelivered", async () => {
    // An unconfigured mailer answers false rather than throwing, which would otherwise leave no trace.
    vi.mocked(sendSsoSignInHintEmail).mockResolvedValue(false);

    await sendSsoSignInHint(user);

    expect(logger.error).toHaveBeenCalledWith(
      { userId: user.id },
      "SSO sign-in hint email was not sent (mailer reported no delivery)"
    );
  });

  test("swallows and logs a failed send, since nothing after the response would catch it", async () => {
    const error = new Error("smtp down");
    vi.mocked(sendSsoSignInHintEmail).mockRejectedValue(error);

    await expect(sendSsoSignInHint(user)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      { err: error, userId: user.id },
      "Failed to send SSO sign-in hint email"
    );
  });

  test("swallows a failed provider lookup too", async () => {
    vi.mocked(prisma.account.findMany).mockRejectedValue(new Error("db down"));

    await expect(sendSsoSignInHint(user)).resolves.toBeUndefined();
    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
  });

  test("swallows a failed licence check too", async () => {
    vi.mocked(getSsoAvailability).mockRejectedValue(new Error("licence server down"));

    await expect(sendSsoSignInHint(user)).resolves.toBeUndefined();
    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
  });

  test("sends nothing when there is no provider at all", async () => {
    await sendSsoSignInHint({ ...user, identityProvider: "email" });

    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
