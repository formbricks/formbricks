import { describe, expect, test } from "vitest";
import { getMcpGrantPermissionsForScopes } from "./grant";
import {
  applyMcpGrantPreset,
  getInitialMcpGrantPermissions,
  getMcpCategoryLevel,
  getMcpGrantEditorCategories,
  getMcpLevelOptions,
  getUnmetMcpPermissionDependencies,
  isMcpGrantEmpty,
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

describe("isMcpGrantEmpty", () => {
  test("is true only when every permission is at No access", () => {
    expect(isMcpGrantEmpty({})).toBe(true);
    expect(isMcpGrantEmpty({ workflowRuns: "read" })).toBe(false);
  });
});

describe("getUnmetMcpPermissionDependencies", () => {
  test("names what Charts needs when Feedback records is at No access", () => {
    expect(getUnmetMcpPermissionDependencies({ charts: "read" })).toEqual({
      charts: [{ permission: "feedbackRecords", level: "read" }],
    });
  });

  test("names nothing once the dependency is given, or when the dependent permission is off", () => {
    expect(getUnmetMcpPermissionDependencies({ charts: "write", feedbackRecords: "read" })).toEqual({});
    expect(getUnmetMcpPermissionDependencies({ feedbackRecords: "read" })).toEqual({});
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
