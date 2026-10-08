import { describe, expect, test } from "vitest";
import {
  appendSearch,
  getLoginRedirectUrl,
  getMarketingRedirectTarget,
  getSettingsRedirectPath,
} from "./marketing-redirects";
import { getOrganizationBillingPath } from "./routes";

const ORG = "org-1";
const WEBAPP_URL = "https://app.formbricks.com";

describe("getSettingsRedirectPath", () => {
  test("bare /settings goes to the organization's general settings", () => {
    expect(getSettingsRedirectPath(ORG, undefined, true)).toBe("/organizations/org-1/settings/general");
    expect(getSettingsRedirectPath(ORG, [], true)).toBe("/organizations/org-1/settings/general");
  });

  test("organization slugs map to organization settings, keeping deeper segments", () => {
    expect(getSettingsRedirectPath(ORG, ["teams"], true)).toBe("/organizations/org-1/settings/teams");
    expect(getSettingsRedirectPath(ORG, ["api-keys", "new"], true)).toBe(
      "/organizations/org-1/settings/api-keys/new"
    );
  });

  test.each(["profile", "notifications", "authorized-apps"])(
    "account slug %s maps to account settings",
    (slug) => {
      expect(getSettingsRedirectPath(ORG, [slug], true)).toBe(`/account/settings/${slug}`);
      expect(getSettingsRedirectPath(ORG, [slug, "deeper"], true)).toBe(`/account/settings/${slug}/deeper`);
    }
  );

  test("an account slug only counts as the first segment", () => {
    expect(getSettingsRedirectPath(ORG, ["general", "profile"], true)).toBe(
      "/organizations/org-1/settings/general/profile"
    );
  });

  test("segments cannot climb out of the settings base or leave the app", () => {
    expect(getSettingsRedirectPath(ORG, ["..", "..", "admin"], true)).toBe(
      "/organizations/org-1/settings/admin"
    );
    expect(getSettingsRedirectPath(ORG, ["", "", "evil.com"], true)).toBe(
      "/organizations/org-1/settings/evil.com"
    );
    expect(getSettingsRedirectPath(ORG, ["."], true)).toBe("/organizations/org-1/settings/general");
    expect(getSettingsRedirectPath(ORG, ["a/b", "c\\d", "x?y#z"], true)).toBe(
      "/organizations/org-1/settings/a%2Fb/c%5Cd/x%3Fy%23z"
    );
  });
});

describe("getSettingsRedirectPath billing", () => {
  test("cloud keeps /settings/billing on the billing page", () => {
    expect(getSettingsRedirectPath(ORG, ["billing"], true)).toBe("/organizations/org-1/settings/billing");
  });

  test("self-hosted sends /settings/billing to the enterprise page, like /billing", () => {
    expect(getSettingsRedirectPath(ORG, ["billing"], false)).toBe(getOrganizationBillingPath(ORG, false));
    expect(getSettingsRedirectPath(ORG, ["billing"], false)).toBe("/organizations/org-1/settings/enterprise");
  });

  test("self-hosted leaves other settings pages alone", () => {
    expect(getSettingsRedirectPath(ORG, ["teams"], false)).toBe("/organizations/org-1/settings/teams");
  });
});

describe("appendSearch", () => {
  test("keeps the query string", () => {
    expect(appendSearch("/a", "?utm_source=x&utm_medium=y")).toBe("/a?utm_source=x&utm_medium=y");
    expect(appendSearch("/a", "utm_source=x")).toBe("/a?utm_source=x");
  });

  test("adds nothing for an empty query", () => {
    expect(appendSearch("/a", "")).toBe("/a");
    expect(appendSearch("/a", "?")).toBe("/a");
  });
});

describe("getLoginRedirectUrl", () => {
  test("encodes the full link, query included, as callbackUrl", () => {
    expect(getLoginRedirectUrl(WEBAPP_URL, "/billing", "?utm_source=x")).toBe(
      `${WEBAPP_URL}/auth/login?callbackUrl=${encodeURIComponent(`${WEBAPP_URL}/billing?utm_source=x`)}`
    );
  });
});

describe("getMarketingRedirectTarget", () => {
  const url = new URL(`${WEBAPP_URL}/settings/teams?utm_campaign=launch`);
  const buildPath = (id: string) => getSettingsRedirectPath(id, ["teams"], true);

  test("logged-out users go to login and come back to the same link", () => {
    const target = getMarketingRedirectTarget({
      isAuthenticated: false,
      organizationId: undefined,
      url,
      webAppUrl: WEBAPP_URL,
      buildPath,
    });
    expect(target).toBe(getLoginRedirectUrl(WEBAPP_URL, "/settings/teams", "?utm_campaign=launch"));
  });

  test("logged-in users without an organization go to the root page", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: true,
        organizationId: undefined,
        url,
        webAppUrl: WEBAPP_URL,
        buildPath,
      })
    ).toBe("/");
  });

  test("logged-in users go to the page of their organization with the query kept", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: true,
        organizationId: ORG,
        url,
        webAppUrl: WEBAPP_URL,
        buildPath,
      })
    ).toBe("/organizations/org-1/settings/teams?utm_campaign=launch");
  });
});
