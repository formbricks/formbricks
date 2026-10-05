import { beforeEach, describe, expect, test, vi } from "vitest";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { getAvailableSsoProviders } from "./available-providers";

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

describe("getAvailableSsoProviders", () => {
  test("offers every configured provider when SSO and SAML are licensed", async () => {
    expect([...(await getAvailableSsoProviders())]).toEqual([
      "google",
      "github",
      "azuread",
      "openid",
      "saml",
    ]);
  });

  test("offers none without the SSO licence, as the login page hides the whole block", async () => {
    vi.mocked(getIsSsoEnabled).mockResolvedValue(false);

    expect(await getAvailableSsoProviders()).toEqual(new Set());
  });

  test("drops SAML without the SAML licence", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

    expect((await getAvailableSsoProviders()).has("saml")).toBe(false);
  });

  test("drops a provider that is not configured on this instance", async () => {
    mocks.configured.azuread = false;

    const available = await getAvailableSsoProviders();

    expect(available.has("azuread")).toBe(false);
    expect(available.has("google")).toBe(true);
  });
});
