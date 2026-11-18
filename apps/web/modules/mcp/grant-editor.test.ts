import { describe, expect, test } from "vitest";
import { getMcpGrantPermissionsForScopes } from "./grant";
import {
  applyMcpGrantPreset,
  canEditMcpGrant,
  getInitialMcpGrantPermissions,
  getMcpCappedHint,
  getMcpCategoryLevel,
  getMcpDependencyHints,
  getMcpGrantEditorCategories,
  getMcpGrantSummary,
  getMcpLevelOptions,
  getUnmetMcpPermissionDependencies,
  hasMcpCappedLevel,
  setMcpCategoryLevel,
  setMcpPermissionLevel,
} from "./grant-editor";
import { MCP_PERMISSIONS, type TMcpPermission } from "./permissions";

const EVERY_SCOPE = [
  "surveys:write",
  "responses:write",
  "workflows:write",
  "dashboards:write",
  "feedbackRecords:write",
  "audience:read",
];
const FULL_CAP = getMcpGrantPermissionsForScopes(EVERY_SCOPE);
const ALL_PERMISSIONS = Object.keys(MCP_PERMISSIONS) as TMcpPermission[];

describe("getMcpGrantEditorCategories", () => {
  test("lists every category of the registry with its permissions, in the registry's order", () => {
    const categories = getMcpGrantEditorCategories({ isDashboardViewer: false });

    expect(categories.map(({ category }) => category)).toEqual([
      "surveys",
      "responses",
      "workflows",
      "dashboards",
      "feedback",
      "audience",
    ]);
    expect(categories[0].permissions).toEqual(["surveys", "creatives", "surveyStyling"]);
    expect(categories.flatMap(({ permissions }) => permissions)).toEqual(ALL_PERMISSIONS);
  });

  test("shows a Dashboard viewer only the Dashboards category", () => {
    expect(getMcpGrantEditorCategories({ isDashboardViewer: true })).toEqual([
      { category: "dashboards", permissions: ["charts", "dashboards"] },
    ]);
  });
});

describe("getMcpLevelOptions", () => {
  test("offers No access, Read and Write for a permission with write tools", () => {
    expect(getMcpLevelOptions(["surveys"], FULL_CAP)).toEqual([
      { level: "none", disabled: false },
      { level: "read", disabled: false },
      { level: "write", disabled: false },
    ]);
  });

  test("offers only No access and Read for a permission with only read tools", () => {
    expect(getMcpLevelOptions(["workflowRuns"], FULL_CAP)).toEqual([
      { level: "none", disabled: false },
      { level: "read", disabled: false },
    ]);
  });

  test("disables the levels above what the client asked for", () => {
    const cap = getMcpGrantPermissionsForScopes(["surveys:read"]);

    expect(getMcpLevelOptions(["surveys"], cap)).toEqual([
      { level: "none", disabled: false },
      { level: "read", disabled: false },
      { level: "write", disabled: true },
    ]);
    expect(getMcpLevelOptions(["workflows"], cap)).toEqual([
      { level: "none", disabled: false },
      { level: "read", disabled: true },
      { level: "write", disabled: true },
    ]);
  });

  test("for a category, offers every level one of its permissions offers, enabled when one can take it", () => {
    const cap = getMcpGrantPermissionsForScopes(["workflows:read"]);

    expect(getMcpLevelOptions(["workflows", "workflowRuns"], cap)).toEqual([
      { level: "none", disabled: false },
      { level: "read", disabled: false },
      { level: "write", disabled: true },
    ]);
    expect(getMcpLevelOptions(["contacts", "segments"], FULL_CAP)).toEqual([
      { level: "none", disabled: false },
      { level: "read", disabled: false },
    ]);
  });
});

describe("setMcpPermissionLevel", () => {
  test("sets one permission's level and leaves the rest", () => {
    expect(
      setMcpPermissionLevel({ surveys: "read", responses: "read" }, "surveys", "write", FULL_CAP)
    ).toEqual({ surveys: "write", responses: "read" });
  });

  test("No access removes the permission", () => {
    expect(
      setMcpPermissionLevel({ surveys: "read", responses: "read" }, "surveys", "none", FULL_CAP)
    ).toEqual({ responses: "read" });
  });

  test("can't raise a permission above what the client asked for", () => {
    const cap = getMcpGrantPermissionsForScopes(["surveys:read"]);

    expect(setMcpPermissionLevel({}, "surveys", "write", cap)).toEqual({ surveys: "read" });
    expect(setMcpPermissionLevel({}, "workflows", "read", cap)).toEqual({});
  });
});

describe("category level", () => {
  test("is the level its permissions share", () => {
    expect(
      getMcpCategoryLevel({ surveys: "read", creatives: "read", surveyStyling: "read" }, [
        "surveys",
        "creatives",
        "surveyStyling",
      ])
    ).toBe("read");
    expect(getMcpCategoryLevel({}, ["surveys", "creatives", "surveyStyling"])).toBe("none");
  });

  // Workflow runs and Feedback datasets only go up to Read: Write on their category sets them to Read, so
  // the category reads as Write, and a migrated grant's chip says Write rather than Custom.
  test("is Write when every permission sits at its own highest level, a read-only one at Read", () => {
    expect(
      getMcpCategoryLevel({ workflows: "write", workflowRuns: "read" }, ["workflows", "workflowRuns"])
    ).toBe("write");
    expect(
      getMcpCategoryLevel({ feedbackRecords: "write", feedbackDatasets: "read" }, [
        "feedbackRecords",
        "feedbackDatasets",
      ])
    ).toBe("write");
    expect(
      getMcpCategoryLevel({ workflows: "read", workflowRuns: "read" }, ["workflows", "workflowRuns"])
    ).toBe("read");
    expect(getMcpCategoryLevel({ workflows: "write" }, ["workflows", "workflowRuns"])).toBe("mixed");
    // What the category's own Write sets reads back as Write.
    const cap = { workflows: "write", workflowRuns: "read" } as const;
    expect(
      getMcpCategoryLevel(setMcpCategoryLevel({}, ["workflows", "workflowRuns"], "write", cap), [
        "workflows",
        "workflowRuns",
      ])
    ).toBe("write");
  });

  test("is no single level when its permissions differ", () => {
    expect(
      getMcpCategoryLevel({ surveys: "write", creatives: "read" }, ["surveys", "creatives", "surveyStyling"])
    ).toBe("mixed");
  });

  test("setting it sets each permission, as far as the permission and the client's request allow", () => {
    const cap = getMcpGrantPermissionsForScopes(["workflows:write", "surveys:read"]);

    expect(setMcpCategoryLevel({ surveys: "read" }, ["workflows", "workflowRuns"], "write", cap)).toEqual({
      surveys: "read",
      workflows: "write",
      workflowRuns: "read",
    });
    expect(
      setMcpCategoryLevel(
        { surveys: "read", creatives: "read" },
        ["surveys", "creatives", "surveyStyling"],
        "none",
        cap
      )
    ).toEqual({});
  });
});

describe("presets", () => {
  test("Read-only sets every permission to Read", () => {
    expect(applyMcpGrantPreset("readOnly", ALL_PERMISSIONS, FULL_CAP)).toEqual(
      Object.fromEntries(ALL_PERMISSIONS.map((permission) => [permission, "read"]))
    );
  });

  test("Select all sets each permission to the highest level it offers", () => {
    const granted = applyMcpGrantPreset("selectAll", ALL_PERMISSIONS, FULL_CAP);

    expect(granted).toMatchObject({
      surveys: "write",
      tags: "write",
      workflowRuns: "read",
      contacts: "read",
    });
    expect(Object.keys(granted)).toHaveLength(ALL_PERMISSIONS.length);
  });

  test("Deselect all sets every permission to No access", () => {
    expect(applyMcpGrantPreset("deselectAll", ALL_PERMISSIONS, FULL_CAP)).toEqual({});
  });

  test("presets never go above what the client asked for", () => {
    const cap = getMcpGrantPermissionsForScopes(["surveys:read"]);

    expect(applyMcpGrantPreset("selectAll", ALL_PERMISSIONS, cap)).toEqual({
      surveys: "read",
      creatives: "read",
      surveyStyling: "read",
    });
    expect(applyMcpGrantPreset("readOnly", ALL_PERMISSIONS, cap)).toEqual({
      surveys: "read",
      creatives: "read",
      surveyStyling: "read",
    });
  });

  test("presets only touch the permissions the editor shows", () => {
    expect(applyMcpGrantPreset("selectAll", ["charts", "dashboards"], FULL_CAP)).toEqual({
      charts: "write",
      dashboards: "write",
    });
  });
});

describe("canEditMcpGrant", () => {
  test("is true for a grant whose client's scopes ask for something", () => {
    expect(canEditMcpGrant({ permissions: {}, cap: { surveys: "read" } })).toBe(true);
  });

  test("is false without a grant", () => {
    expect(canEditMcpGrant({ permissions: null, cap: { surveys: "read" } })).toBe(false);
  });

  test("is false for a client capped at nothing, which Edit could give nothing", () => {
    expect(canEditMcpGrant({ permissions: { surveys: "read" }, cap: {} })).toBe(false);
  });
});

describe("getUnmetMcpPermissionDependencies", () => {
  test("names what Charts needs when Feedback records is at No access", () => {
    expect(getUnmetMcpPermissionDependencies({ charts: "read" })).toEqual({
      charts: [{ permission: "feedbackRecords", level: "read" }],
    });
  });

  test("names what Contacts and Segments need for the data their tools return, and nothing for Workflow runs", () => {
    expect(
      getUnmetMcpPermissionDependencies({ workflowRuns: "read", contacts: "read", segments: "read" })
    ).toEqual({
      contacts: [{ permission: "contactAttributes", level: "read" }],
      segments: [{ permission: "contactAttributes", level: "read" }],
    });
  });

  test("names nothing once the dependency is given, or when the dependent permission is off", () => {
    expect(getUnmetMcpPermissionDependencies({ charts: "write", feedbackRecords: "read" })).toEqual({});
    expect(getUnmetMcpPermissionDependencies({ feedbackRecords: "read" })).toEqual({});
  });
});

// The matrix's reconnect hint (spec story 14): shown on a toggle only when the client's scopes disable a
// level it offers.
describe("hasMcpCappedLevel", () => {
  test("is true when the scopes leave a level the permission offers out of reach", () => {
    expect(hasMcpCappedLevel(getMcpLevelOptions(["charts"], { charts: "read" }))).toBe(true);
    expect(hasMcpCappedLevel(getMcpLevelOptions(["surveys", "creatives"], {}))).toBe(true);
  });

  test("is false when every level offered can be chosen, a read-only permission's included", () => {
    expect(hasMcpCappedLevel(getMcpLevelOptions(["charts"], { charts: "write" }))).toBe(false);
    // Workflow runs offer no Write, so Read is the whole cap and nothing is held back.
    expect(hasMcpCappedLevel(getMcpLevelOptions(["workflowRuns"], { workflowRuns: "read" }))).toBe(false);
  });
});

// A Dashboard viewer's levels are capped by the role, which a reconnect can't change (smoke D).
describe("getMcpCappedHint", () => {
  const capped = getMcpLevelOptions(["dashboards"], { dashboards: "read" });
  const open = getMcpLevelOptions(["dashboards"], { dashboards: "write" });

  test("names the role for a Dashboard viewer, so the hint doesn't ask for a reconnect", () => {
    expect(getMcpCappedHint(capped, { isDashboardViewer: true })).toBe("role");
  });

  test("names the client's scopes for anyone else, and nothing when no level is disabled", () => {
    expect(getMcpCappedHint(capped, { isDashboardViewer: false })).toBe("scopes");
    expect(getMcpCappedHint(open, { isDashboardViewer: true })).toBeNull();
    expect(getMcpCappedHint(open, { isDashboardViewer: false })).toBeNull();
  });
});

// The hints under a permission (spec story 16), and the viewer-only matrix (story 20), which has none.
describe("getMcpDependencyHints", () => {
  test("names what Charts needs, marked while the grant leaves it out", () => {
    expect(getMcpDependencyHints("charts", { charts: "read" }, { isDashboardViewer: false })).toEqual([
      { requirement: { permission: "feedbackRecords", level: "read" }, isUnmet: true },
    ]);
    expect(
      getMcpDependencyHints(
        "charts",
        { charts: "read", feedbackRecords: "read" },
        { isDashboardViewer: false }
      )
    ).toEqual([{ requirement: { permission: "feedbackRecords", level: "read" }, isUnmet: false }]);
  });

  test("names it unmarked while the permission itself is off", () => {
    expect(getMcpDependencyHints("contacts", {}, { isDashboardViewer: false })).toEqual([
      { requirement: { permission: "contactAttributes", level: "read" }, isUnmet: false },
    ]);
  });

  test("shows nothing for a permission without dependencies", () => {
    expect(getMcpDependencyHints("surveys", { surveys: "read" }, { isDashboardViewer: false })).toEqual([]);
  });

  // `get_dashboard` and the dashboard and widget writes declare Charts: Read beside Dashboards.
  test("names Charts: Read under Dashboards, marked while the grant leaves it out", () => {
    expect(
      getMcpDependencyHints("dashboards", { dashboards: "write" }, { isDashboardViewer: false })
    ).toEqual([{ requirement: { permission: "charts", level: "read" }, isUnmet: true }]);
    expect(
      getMcpDependencyHints(
        "dashboards",
        { dashboards: "read", charts: "read" },
        { isDashboardViewer: false }
      )
    ).toEqual([{ requirement: { permission: "charts", level: "read" }, isUnmet: false }]);
  });

  test("shows a Dashboard viewer no hint, since Feedback records is outside their matrix", () => {
    expect(getMcpDependencyHints("charts", { charts: "read" }, { isDashboardViewer: true })).toEqual([]);
  });
});

describe("getInitialMcpGrantPermissions", () => {
  test("a first connect opens with what the client asked for", () => {
    const cap = getMcpGrantPermissionsForScopes(["surveys:read", "responses:write"]);

    expect(getInitialMcpGrantPermissions({ existing: null, cap })).toEqual({
      surveys: "read",
      creatives: "read",
      surveyStyling: "read",
      responses: "write",
      tags: "write",
    });
  });

  test("a client that already has a grant opens with that grant", () => {
    expect(getInitialMcpGrantPermissions({ existing: { surveys: "read" }, cap: FULL_CAP })).toEqual({
      surveys: "read",
    });
  });

  test("an existing grant is held to what the client asks for now", () => {
    const cap = getMcpGrantPermissionsForScopes(["surveys:read"]);

    expect(getInitialMcpGrantPermissions({ existing: { surveys: "write", workflows: "read" }, cap })).toEqual(
      { surveys: "read" }
    );
  });
});

describe("getMcpGrantSummary", () => {
  test("gives one level per category, mixed where its permissions differ", () => {
    expect(
      getMcpGrantSummary(
        {
          surveys: "write",
          creatives: "write",
          surveyStyling: "write",
          responses: "read",
          workflows: "write",
        },
        { isDashboardViewer: false }
      )
    ).toEqual([
      { category: "surveys", level: "write" },
      { category: "responses", level: "mixed" },
      { category: "workflows", level: "mixed" },
      { category: "dashboards", level: "none" },
      { category: "feedback", level: "none" },
      { category: "audience", level: "none" },
    ]);
  });

  test("shows a Dashboard viewer's grant as Dashboards alone, like the editor", () => {
    expect(getMcpGrantSummary({ charts: "read", dashboards: "read" }, { isDashboardViewer: true })).toEqual([
      { category: "dashboards", level: "read" },
    ]);
  });
});
