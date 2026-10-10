import { describe, expect, test } from "vitest";
import {
  MARKETING_SECTIONS,
  type TMarketingDestination,
  type TMarketingSectionSlug,
  appendSearch,
  getMarketingRedirectTarget,
  getSectionDestination,
  getSettingsDestination,
  isMarketingLinkPath,
} from "./marketing-redirects";

const ORG = "org-1";
const WS = "ws-1";

const build = (destination: TMarketingDestination) =>
  destination.buildPath(destination.scope === "workspace" ? WS : ORG);

describe("getSettingsDestination", () => {
  test.each<[string[] | undefined, string]>([
    [undefined, "/organizations/org-1/settings/general"],
    [[], "/organizations/org-1/settings/general"],
    [["teams"], "/organizations/org-1/settings/teams"],
    [["api-keys"], "/organizations/org-1/settings/api-keys"],
    [["feedback-directories"], "/organizations/org-1/settings/feedback-directories"],
    [["billing"], "/organizations/org-1/settings/billing"],
    [["enterprise"], "/organizations/org-1/settings/billing"],
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
    // Self-hosted-only pages 404 on Cloud, so they open General there.
    [["usage"], "/organizations/org-1/settings/general"],
    [["domain"], "/organizations/org-1/settings/general"],
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
  ])("Cloud: /settings %j -> %s", (segments, expected) => {
    expect(build(getSettingsDestination(segments, true))).toBe(expected);
  });

  test.each<[string[], string]>([
    [["usage"], "/organizations/org-1/settings/usage"],
    [["domain"], "/organizations/org-1/settings/domain"],
    [["billing"], "/organizations/org-1/settings/enterprise"],
    [["enterprise"], "/organizations/org-1/settings/enterprise"],
  ])("self-hosted: /settings %j -> %s", (segments, expected) => {
    expect(build(getSettingsDestination(segments, false))).toBe(expected);
  });
});

describe("getSectionDestination", () => {
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
    ["contacts", ["Segments"], "/workspaces/ws-1/segments"],
    // Unknown, extra or crafted sub-segments open the section's main page and are never echoed.
    ["integrations", ["zapier"], "/workspaces/ws-1/settings/workspace/integrations"],
    ["integrations", ["slack", "extra"], "/workspaces/ws-1/settings/workspace/integrations"],
    ["contacts", ["..", "evil.com"], "/workspaces/ws-1/contacts"],
    ["contacts", ["constructor"], "/workspaces/ws-1/contacts"],
    ["surveys", ["anything"], "/workspaces/ws-1/surveys"],
  ])("Cloud: /%s %j -> %s", (slug, segments, expected) => {
    expect(build(getSectionDestination(slug, segments, true))).toBe(expected);
  });

  test("/enterprise-license opens the enterprise page on self-hosted", () => {
    expect(build(getSectionDestination("enterprise-license", [], false))).toBe(
      "/organizations/org-1/settings/enterprise"
    );
  });
});

describe("isMarketingLinkPath", () => {
  test.each([
    "/billing",
    "/settings",
    "/settings/teams",
    ...Object.keys(MARKETING_SECTIONS).map((s) => `/${s}`),
  ])("%s is a marketing link", (pathname) => {
    expect(isMarketingLinkPath(pathname)).toBe(true);
  });

  test.each(["/billing-confirmation", "/surveysx", "/", "/s/abc", "/api/mcp", "/auth/login"])(
    "%s is not a marketing link",
    (pathname) => {
      expect(isMarketingLinkPath(pathname)).toBe(false);
    }
  );
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

describe("getMarketingRedirectTarget", () => {
  const surveys = getSectionDestination("surveys", [], true);
  const base = { isFormbricksCloud: true, search: "?utm_source=x" };

  test("without an organization opens the root page", () => {
    expect(getMarketingRedirectTarget({ ...base, organizationId: undefined, destination: surveys })).toBe(
      "/"
    );
  });

  test("organization links open in the organization with the query kept", () => {
    expect(
      getMarketingRedirectTarget({
        ...base,
        organizationId: ORG,
        destination: getSettingsDestination(["teams"], true),
      })
    ).toBe("/organizations/org-1/settings/teams?utm_source=x");
  });

  test("workspace links open in the workspace with the query kept", () => {
    expect(
      getMarketingRedirectTarget({ ...base, organizationId: ORG, workspaceId: WS, destination: surveys })
    ).toBe("/workspaces/ws-1/surveys?utm_source=x");
  });

  test("a workspace link without a workspace opens the landing page", () => {
    expect(getMarketingRedirectTarget({ ...base, organizationId: ORG, destination: surveys })).toBe(
      "/organizations/org-1/landing?utm_source=x"
    );
  });

  test("a billing member without a workspace goes to billing", () => {
    expect(
      getMarketingRedirectTarget({
        ...base,
        organizationId: ORG,
        isBillingMember: true,
        destination: surveys,
      })
    ).toBe("/organizations/org-1/settings/billing?utm_source=x");
  });
});
