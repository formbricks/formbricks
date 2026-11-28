import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getLinkedSsoProviders, getOfferedSsoProviders } from "./linked-sso-providers";
import type { TSsoIdentityProvider } from "./provider-normalization";
import { getSsoAvailability } from "./sso-availability";

vi.mock("server-only", () => ({}));

vi.mock("./sso-availability", () => ({
  getSsoAvailability: vi.fn(),
}));

const ALL_PROVIDERS: TSsoIdentityProvider[] = ["google", "github", "azuread", "openid", "saml"];

const user = { id: "user-1", identityProvider: "azuread" as const };

const linkAccounts = (...providers: string[]) =>
  // Only `provider` is selected, so that is all a row carries here.
  prisma.account.findMany.mockResolvedValue(providers.map((provider) => ({ provider })) as never);

const offerOnLoginPage = (...offered: TSsoIdentityProvider[]) =>
  vi.mocked(getSsoAvailability).mockResolvedValue({
    isSsoEnabled: offered.length > 0,
    providers: Object.fromEntries(ALL_PROVIDERS.map((p) => [p, offered.includes(p)])) as Record<
      TSsoIdentityProvider,
      boolean
    >,
  });

beforeEach(() => {
  vi.mocked(getSsoAvailability).mockReset();
  linkAccounts();
  offerOnLoginPage(...ALL_PROVIDERS);
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

describe("getOfferedSsoProviders", () => {
  test("returns the user's providers the login page offers", async () => {
    linkAccounts("google", "github");
    offerOnLoginPage("github");

    expect(await getOfferedSsoProviders({ ...user, identityProvider: "google" })).toEqual(["github"]);
  });

  test("returns every linked provider while all are offered", async () => {
    linkAccounts("google");

    expect(await getOfferedSsoProviders(user)).toEqual(["azuread", "google"]);
  });

  test.each([
    ["the licence has lapsed", []],
    ["only other providers are offered", ["google", "saml"]],
  ] as const)("returns none when %s", async (_label, offered) => {
    offerOnLoginPage(...offered);

    expect(await getOfferedSsoProviders(user)).toEqual([]);
  });

  test("returns none for a password user without reading accounts or the licence", async () => {
    // A stray SSO row on a password account does not make it an SSO account (ENG-2590, case 4).
    linkAccounts("google");

    expect(await getOfferedSsoProviders({ ...user, identityProvider: "email" })).toEqual([]);
    expect(prisma.account.findMany).not.toHaveBeenCalled();
    expect(getSsoAvailability).not.toHaveBeenCalled();
  });

  test.each([
    ["account lookup", () => prisma.account.findMany.mockRejectedValue(new Error("db down"))],
    ["licence check", () => vi.mocked(getSsoAvailability).mockRejectedValue(new Error("licence down"))],
  ])("throws when the %s fails, so a gate on it can fail closed", async (_label, fail) => {
    fail();

    await expect(getOfferedSsoProviders(user)).rejects.toThrow();
  });
});
