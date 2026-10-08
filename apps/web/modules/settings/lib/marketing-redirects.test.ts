import { describe, expect, test } from "vitest";
import {
  type TMarketingSectionSlug,
  appendSearch,
  getLoginRedirectUrl,
  getMarketingRedirectTarget,
  getSectionDestination,
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
  const destination = {
    scope: "organization" as const,
    buildPath: (id: string) => getSettingsRedirectPath(id, ["teams"], true),
  };

  test("logged-out users go to login and come back to the same link", () => {
    const target = getMarketingRedirectTarget({
      isAuthenticated: false,
      organizationId: undefined,
      url,
      webAppUrl: WEBAPP_URL,
      destination,
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
        destination,
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
        destination,
      })
    ).toBe("/organizations/org-1/settings/teams?utm_campaign=launch");
  });
});

describe("feature links (MARKETING_SECTIONS)", () => {
  const WS = "ws-1";

  const resolve = (slug: TMarketingSectionSlug, segments: string[], search = "") => {
    const pathname = `/${[slug, ...segments].join("/")}`;
    return getMarketingRedirectTarget({
      isAuthenticated: true,
      organizationId: ORG,
      workspaceId: WS,
      url: new URL(`${WEBAPP_URL}${pathname}${search}`),
      webAppUrl: WEBAPP_URL,
      destination: getSectionDestination(slug, segments),
    });
  };

  test.each<[TMarketingSectionSlug, string[], string]>([
    ["embedded-data", [], "/workspaces/ws-1/settings/workspace/embedded-data"],
    ["enterprise-license", [], "/organizations/org-1/settings/enterprise"],
    ["mcp", [], "/account/settings/authorized-apps"],
    ["contacts", [], "/workspaces/ws-1/contacts"],
    ["contacts", ["segments"], "/workspaces/ws-1/segments"],
    ["contacts", ["attributes"], "/workspaces/ws-1/attributes"],
    ["branding-removal", [], "/workspaces/ws-1/settings/workspace/look"],
    ["feedback-unification", [], "/workspaces/ws-1/unify/feedback-records"],
    ["feedback-unification", ["sources"], "/workspaces/ws-1/unify/sources"],
    ["feedback-unification", ["feedback-records"], "/workspaces/ws-1/unify/feedback-records"],
    ["feedback-unification", ["taxonomy"], "/workspaces/ws-1/unify/taxonomy"],
    ["analysis", [], "/workspaces/ws-1/dashboards"],
    ["analysis", ["dashboards"], "/workspaces/ws-1/dashboards"],
    ["analysis", ["charts"], "/workspaces/ws-1/charts"],
    ["workflows", [], "/workspaces/ws-1/workflows"],
    ["workflows", ["runs"], "/workspaces/ws-1/workflows/runs"],
    ["surveys", [], "/workspaces/ws-1/surveys"],
    ["integrations", [], "/workspaces/ws-1/settings/workspace/integrations"],
    ["integrations", ["slack"], "/workspaces/ws-1/settings/workspace/integrations/slack"],
    ["integrations", ["notion"], "/workspaces/ws-1/settings/workspace/integrations/notion"],
    ["integrations", ["airtable"], "/workspaces/ws-1/settings/workspace/integrations/airtable"],
    ["integrations", ["google-sheets"], "/workspaces/ws-1/settings/workspace/integrations/google-sheets"],
    ["integrations", ["webhooks"], "/workspaces/ws-1/settings/workspace/integrations/webhooks"],
    // Unknown, extra or crafted sub-segments open the section's main page and are never echoed.
    ["integrations", ["zapier"], "/workspaces/ws-1/settings/workspace/integrations"],
    ["integrations", ["slack", "extra"], "/workspaces/ws-1/settings/workspace/integrations"],
    ["contacts", ["..", "evil.com"], "/workspaces/ws-1/contacts"],
    ["contacts", ["constructor"], "/workspaces/ws-1/contacts"],
    ["surveys", ["anything"], "/workspaces/ws-1/surveys"],
  ])("/%s %j -> %s", (slug, segments, expected) => {
    expect(resolve(slug, segments)).toBe(expected);
  });

  test("keeps the query string", () => {
    expect(resolve("contacts", ["segments"], "?utm_source=newsletter&utm_campaign=q4")).toBe(
      "/workspaces/ws-1/segments?utm_source=newsletter&utm_campaign=q4"
    );
  });

  test("a workspace link without an accessible workspace opens the organization's landing page", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: true,
        organizationId: ORG,
        workspaceId: undefined,
        url: new URL(`${WEBAPP_URL}/surveys?utm_source=x`),
        webAppUrl: WEBAPP_URL,
        destination: getSectionDestination("surveys", []),
      })
    ).toBe("/organizations/org-1/landing?utm_source=x");
  });

  test("a workspace link without an organization opens the root page", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: true,
        organizationId: undefined,
        url: new URL(`${WEBAPP_URL}/surveys`),
        webAppUrl: WEBAPP_URL,
        destination: getSectionDestination("surveys", []),
      })
    ).toBe("/");
  });

  test("organization links do not need a workspace", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: true,
        organizationId: ORG,
        workspaceId: undefined,
        url: new URL(`${WEBAPP_URL}/enterprise-license`),
        webAppUrl: WEBAPP_URL,
        destination: getSectionDestination("enterprise-license", []),
      })
    ).toBe("/organizations/org-1/settings/enterprise");
  });

  test("logged-out users go to login and come back to the same link", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: false,
        organizationId: undefined,
        url: new URL(`${WEBAPP_URL}/workflows/runs?utm_source=x`),
        webAppUrl: WEBAPP_URL,
        destination: getSectionDestination("workflows", ["runs"]),
      })
    ).toBe(getLoginRedirectUrl(WEBAPP_URL, "/workflows/runs", "?utm_source=x"));
  });
});
