import { describe, expect, test } from "vitest";
import {
  type TMarketingSectionSlug,
  appendSearch,
  getLoginRedirectUrl,
  getMarketingRedirectTarget,
  getSectionDestination,
  getSettingsDestination,
} from "./marketing-redirects";
import { getOrganizationBillingPath } from "./routes";

const ORG = "org-1";
const WEBAPP_URL = "https://app.formbricks.com";

describe("getSettingsDestination", () => {
  const WS = "ws-1";
  const resolve = (segments: string[] | undefined, isFormbricksCloud = true) => {
    const destination = getSettingsDestination(segments, isFormbricksCloud);
    return destination.buildPath(destination.scope === "workspace" ? WS : ORG);
  };

  test.each<[string[] | undefined, string]>([
    [undefined, "/organizations/org-1/settings/general"],
    [[], "/organizations/org-1/settings/general"],
    [["teams"], "/organizations/org-1/settings/teams"],
    [["api-keys"], "/organizations/org-1/settings/api-keys"],
    [["usage"], "/organizations/org-1/settings/usage"],
    [["domain"], "/organizations/org-1/settings/domain"],
    [["feedback-directories"], "/organizations/org-1/settings/feedback-directories"],
    [["billing"], "/organizations/org-1/settings/billing"],
    [["profile"], "/account/settings/profile"],
    [["notifications"], "/account/settings/notifications"],
    [["authorized-apps"], "/account/settings/authorized-apps"],
    [["look"], "/workspaces/ws-1/settings/workspace/look"],
    [["languages"], "/workspaces/ws-1/settings/workspace/languages"],
    [["tags"], "/workspaces/ws-1/settings/workspace/tags"],
    [["embedded-data"], "/workspaces/ws-1/settings/workspace/embedded-data"],
    [["app-connection"], "/workspaces/ws-1/settings/workspace/app-connection"],
    [["user-actions"], "/workspaces/ws-1/settings/workspace/user-actions"],
    [["integrations"], "/workspaces/ws-1/settings/workspace/integrations"],
    [["integrations", "slack"], "/workspaces/ws-1/settings/workspace/integrations/slack"],
    [["integrations", "zapier"], "/workspaces/ws-1/settings/workspace/integrations"],
    // Case and stray whitespace from marketing copy.
    [["Teams"], "/organizations/org-1/settings/teams"],
    [["Look "], "/workspaces/ws-1/settings/workspace/look"],
    // Unknown, crafted or extra segments open General and are never echoed.
    [["does-not-exist"], "/organizations/org-1/settings/general"],
    [["..", "..", "admin"], "/organizations/org-1/settings/general"],
    [["", "evil.com"], "/organizations/org-1/settings/general"],
    [["a/b"], "/organizations/org-1/settings/general"],
    [["constructor"], "/organizations/org-1/settings/general"],
    [["profile", "deeper"], "/account/settings/profile"],
  ])("/settings %j -> %s", (segments, expected) => {
    expect(resolve(segments)).toBe(expected);
  });

  test("workspace settings pages need a workspace, the others only an organization", () => {
    expect(getSettingsDestination(["look"], true).scope).toBe("workspace");
    expect(getSettingsDestination(["teams"], true).scope).toBe("organization");
    expect(getSettingsDestination(["profile"], true).scope).toBe("organization");
  });

  test("billing and enterprise open billing on Cloud and enterprise on self-hosted", () => {
    expect(resolve(["billing"], true)).toBe(getOrganizationBillingPath(ORG, true));
    expect(resolve(["enterprise"], true)).toBe(getOrganizationBillingPath(ORG, true));
    expect(resolve(["billing"], false)).toBe("/organizations/org-1/settings/enterprise");
    expect(resolve(["enterprise"], false)).toBe("/organizations/org-1/settings/enterprise");
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
  const destination = getSettingsDestination(["teams"], true);

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

  const resolve = (
    slug: TMarketingSectionSlug,
    segments: string[],
    search = "",
    isFormbricksCloud = true
  ) => {
    const pathname = `/${[slug, ...segments].join("/")}`;
    return getMarketingRedirectTarget({
      isAuthenticated: true,
      organizationId: ORG,
      workspaceId: WS,
      url: new URL(`${WEBAPP_URL}${pathname}${search}`),
      webAppUrl: WEBAPP_URL,
      destination: getSectionDestination(slug, segments, isFormbricksCloud),
    });
  };

  test.each<[TMarketingSectionSlug, string[], string]>([
    ["embedded-data", [], "/workspaces/ws-1/settings/workspace/embedded-data"],
    ["enterprise-license", [], "/organizations/org-1/settings/billing"],
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
    ["contacts", ["Segments"], "/workspaces/ws-1/segments"],
  ])("/%s %j -> %s", (slug, segments, expected) => {
    expect(resolve(slug, segments)).toBe(expected);
  });

  test("keeps the query string", () => {
    expect(resolve("contacts", ["segments"], "?utm_source=newsletter&utm_campaign=q4")).toBe(
      "/workspaces/ws-1/segments?utm_source=newsletter&utm_campaign=q4"
    );
  });

  test("/enterprise-license opens the enterprise page on self-hosted", () => {
    expect(resolve("enterprise-license", [], "", false)).toBe("/organizations/org-1/settings/enterprise");
  });

  test("a workspace link without an accessible workspace opens the organization home", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: true,
        organizationId: ORG,
        workspaceId: undefined,
        url: new URL(`${WEBAPP_URL}/surveys?utm_source=x`),
        webAppUrl: WEBAPP_URL,
        destination: getSectionDestination("surveys", [], true),
      })
    ).toBe("/organizations/org-1?utm_source=x");
  });

  test("a workspace link without an organization opens the root page", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: true,
        organizationId: undefined,
        url: new URL(`${WEBAPP_URL}/surveys`),
        webAppUrl: WEBAPP_URL,
        destination: getSectionDestination("surveys", [], true),
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
        destination: getSectionDestination("enterprise-license", [], true),
      })
    ).toBe("/organizations/org-1/settings/billing");
  });

  test("logged-out users go to login and come back to the same link", () => {
    expect(
      getMarketingRedirectTarget({
        isAuthenticated: false,
        organizationId: undefined,
        url: new URL(`${WEBAPP_URL}/workflows/runs?utm_source=x`),
        webAppUrl: WEBAPP_URL,
        destination: getSectionDestination("workflows", ["runs"], true),
      })
    ).toBe(getLoginRedirectUrl(WEBAPP_URL, "/workflows/runs", "?utm_source=x"));
  });
});
