import { beforeEach, describe, expect, test, vi } from "vitest";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSsoAvailability, toSsoFormProps } from "./sso-availability";

const mocks = vi.hoisted(() => ({
  configured: { google: true, github: true, azuread: true, openid: true, saml: true },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/constants", () => ({
  get GOOGLE_OAUTH_ENABLED() {
    return mocks.configured.google;
  },
  get GITHUB_OAUTH_ENABLED() {
    return mocks.configured.github;
  },
  get AZURE_OAUTH_ENABLED() {
    return mocks.configured.azuread;
  },
  get OIDC_OAUTH_ENABLED() {
    return mocks.configured.openid;
  },
  get SAML_OAUTH_ENABLED() {
    return mocks.configured.saml;
  },
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSsoEnabled: vi.fn(),
  getIsSamlSsoEnabled: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured = { google: true, github: true, azuread: true, openid: true, saml: true };
  vi.mocked(getIsSsoEnabled).mockResolvedValue(true);
  vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
});

describe("getSsoAvailability", () => {
  test("offers every configured provider when SSO and SAML are licensed", async () => {
    expect(await getSsoAvailability()).toEqual({
      isSsoEnabled: true,
      providers: { google: true, github: true, azuread: true, openid: true, saml: true },
    });
  });

  test("offers none without the SSO licence, as the pages hide the whole block", async () => {
    vi.mocked(getIsSsoEnabled).mockResolvedValue(false);

    expect(await getSsoAvailability()).toEqual({
      isSsoEnabled: false,
      providers: { google: false, github: false, azuread: false, openid: false, saml: false },
    });
  });

  test("drops SAML without the SAML licence", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

    expect((await getSsoAvailability()).providers.saml).toBe(false);
  });

  test("drops SAML when it is licensed but not configured", async () => {
    mocks.configured.saml = false;

    expect((await getSsoAvailability()).providers.saml).toBe(false);
  });

  test("drops a provider that is not configured on this instance", async () => {
    mocks.configured.azuread = false;

    const { providers } = await getSsoAvailability();

    expect(providers.azuread).toBe(false);
    expect(providers.google).toBe(true);
  });
});

describe("toSsoFormProps", () => {
  test("maps each provider onto the prop the login and signup forms read", () => {
    expect(
      toSsoFormProps({
        isSsoEnabled: true,
        providers: { google: true, github: false, azuread: true, openid: false, saml: true },
      })
    ).toEqual({
      isSsoEnabled: true,
      googleOAuthEnabled: true,
      githubOAuthEnabled: false,
      azureOAuthEnabled: true,
      oidcOAuthEnabled: false,
      samlSsoEnabled: true,
    });
  });
});
