import { describe, expect, test } from "vitest";
import {
  getMcpCategoryLabel,
  getMcpCategoryLevelLabel,
  getMcpDependencyHint,
  getMcpGrantSummaryChips,
  getMcpPermissionLabel,
} from "./grant-editor-labels";
import { MCP_PERMISSIONS, MCP_PERMISSION_CATEGORIES, type TMcpPermission } from "./permissions";

/** Echoes the key, and the values it was given, so a test sees which string was asked for. */
const t = (key: string, values?: Record<string, string>) =>
  values ? `${key} ${JSON.stringify(values)}` : key;

describe("grant editor labels", () => {
  test("every category and permission in the registry has a translated label", () => {
    for (const category of MCP_PERMISSION_CATEGORIES) {
      expect(getMcpCategoryLabel(category, t)).toMatch(/^auth\.oauth\.grant\.categories\./);
    }
    for (const permission of Object.keys(MCP_PERMISSIONS) as TMcpPermission[]) {
      expect(getMcpPermissionLabel(permission, t)).toMatch(/^auth\.oauth\.grant\.permissions\./);
    }
  });

  test("a dependency hint names the permission and level it needs", () => {
    expect(getMcpDependencyHint({ permission: "feedbackRecords", level: "read" }, t)).toBe(
      'auth.oauth.grant.needs_permission {"permission":"auth.oauth.grant.permissions.feedback_records","level":"auth.oauth.grant.levels.read"}'
    );
  });

  test("a category whose permissions differ reads as a custom level, the others as their level", () => {
    expect(getMcpCategoryLevelLabel("mixed", t)).toBe("auth.oauth.grant.levels.custom");
    expect(getMcpCategoryLevelLabel("none", t)).toBe("auth.oauth.grant.levels.no_access");
  });
});

// Authorized apps' summary chips (spec stories 9, 20 and 29), as the list renders them.
describe("getMcpGrantSummaryChips", () => {
  /** English for the words a chip is made of, so the expectations read as what the list shows. */
  const english = (key: string): string =>
    ({
      "auth.oauth.grant.categories.surveys": "Surveys",
      "auth.oauth.grant.categories.responses": "Responses",
      "auth.oauth.grant.categories.workflows": "Workflows",
      "auth.oauth.grant.categories.dashboards": "Dashboards",
      "auth.oauth.grant.categories.feedback": "Feedback",
      "auth.oauth.grant.categories.audience": "Audience",
      "auth.oauth.grant.levels.no_access": "No access",
      "auth.oauth.grant.levels.read": "Read",
      "auth.oauth.grant.levels.write": "Write",
      "auth.oauth.grant.levels.custom": "Custom",
    })[key] ?? key;

  test("one chip per category: Custom where its permissions differ, No access where it gives nothing", () => {
    const chips = getMcpGrantSummaryChips(
      { surveys: "write", creatives: "write", surveyStyling: "read", charts: "read", dashboards: "read" },
      { isDashboardViewer: false },
      english
    );

    expect(chips.map(({ label }) => label)).toEqual([
      "Surveys · Custom",
      "Responses · No access",
      "Workflows · No access",
      "Dashboards · Read",
      "Feedback · No access",
      "Audience · No access",
    ]);
    expect(chips[0].level).toBe("mixed");
  });

  // An upgraded grant at the scopes' Write gives Workflow runs and Feedback datasets their highest, Read.
  test("a migrated Write grant's Workflows and Feedback chips say Write, not Custom", () => {
    const labels = getMcpGrantSummaryChips(
      { workflows: "write", workflowRuns: "read", feedbackRecords: "write", feedbackDatasets: "read" },
      { isDashboardViewer: false },
      english
    ).map(({ label }) => label);

    expect(labels).toContain("Workflows · Write");
    expect(labels).toContain("Feedback · Write");
  });

  test("a Dashboard viewer's grant shows the Dashboards chip alone", () => {
    expect(
      getMcpGrantSummaryChips(
        { surveys: "write", charts: "read", dashboards: "read" },
        { isDashboardViewer: true },
        english
      )
    ).toEqual([{ category: "dashboards", level: "read", label: "Dashboards · Read" }]);
  });
});
