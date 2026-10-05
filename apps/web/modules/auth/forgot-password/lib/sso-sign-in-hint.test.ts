import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { sendSsoSignInHintEmail } from "@/modules/email";
import { getSsoSignInProviderNames, sendSsoSignInHint } from "./sso-sign-in-hint";

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

vi.mock("@/modules/email", () => ({
  sendSsoSignInHintEmail: vi.fn(),
}));

const user = {
  id: "user-1",
  email: "silvija@example.com",
  locale: "nl-NL",
  identityProvider: "azuread" as const,
};

const linkAccounts = (...providers: string[]) =>
  vi.mocked(prisma.account.findMany).mockResolvedValue(
    // Only `provider` is selected, so that is all a row carries here.
    providers.map((provider) => ({ provider })) as unknown as Awaited<
      ReturnType<typeof prisma.account.findMany>
    >
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.oidcDisplayName.value = undefined;
  linkAccounts();
});

describe("getSsoSignInProviderNames", () => {
  test("reads only this user's non-credential accounts", async () => {
    await getSsoSignInProviderNames(user);

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { userId: user.id, provider: { not: "credential" } },
      select: { provider: true },
    });
  });

  test("names every linked provider once, the one the account was created with first", async () => {
    // `azure-ad` is the NextAuth-era spelling of the same provider still found on old rows.
    linkAccounts("google", "azure-ad", "azuread");

    expect(await getSsoSignInProviderNames(user)).toEqual(["Microsoft", "Google"]);
  });

  test("falls back to the identity provider when no SSO account row is linked", async () => {
    expect(await getSsoSignInProviderNames({ ...user, identityProvider: "github" })).toEqual(["GitHub"]);
  });

  test("drops provider ids it cannot name instead of showing them raw", async () => {
    linkAccounts("some-legacy-provider");

    expect(await getSsoSignInProviderNames(user)).toEqual(["Microsoft"]);
  });

  test("uses the operator's OIDC display name, as the login button does", async () => {
    mocks.oidcDisplayName.value = "Acme SSO";

    expect(await getSsoSignInProviderNames({ ...user, identityProvider: "openid" })).toEqual(["Acme SSO"]);
  });

  test("calls an unnamed OIDC provider OpenID", async () => {
    expect(await getSsoSignInProviderNames({ ...user, identityProvider: "openid" })).toEqual(["OpenID"]);
  });
});

describe("sendSsoSignInHint", () => {
  test("mails the provider names to the address on file, in the user's locale", async () => {
    vi.mocked(sendSsoSignInHintEmail).mockResolvedValue(true);

    await sendSsoSignInHint(user);

    expect(sendSsoSignInHintEmail).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      locale: user.locale,
      providerNames: ["Microsoft"],
    });
    expect(logger.error).not.toHaveBeenCalled();
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

  test("swallows and logs a failure, so the caller's generic answer is unaffected", async () => {
    const error = new Error("smtp down");
    vi.mocked(sendSsoSignInHintEmail).mockRejectedValue(error);

    await expect(sendSsoSignInHint(user)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      { error, userId: user.id },
      "Failed to send SSO sign-in hint email"
    );
  });

  test("swallows a failed provider lookup too", async () => {
    vi.mocked(prisma.account.findMany).mockRejectedValue(new Error("db down"));

    await expect(sendSsoSignInHint(user)).resolves.toBeUndefined();
    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
  });

  test("sends nothing when there is no provider to name", async () => {
    await sendSsoSignInHint({ ...user, identityProvider: "email" });

    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
