import { describe, expect, test } from "vitest";
import {
  MCP_PERMISSIONS,
  MCP_PERMISSION_CATEGORIES,
  MCP_PERMISSION_DEPENDENCIES,
  getMcpPermissionScope,
  isMcpPermissionRequirement,
} from "./permissions";

/**
 * The permission catalogue from the engineering spec (P-ENG-103, "5. Engineering spec"), written out by
 * hand so the registry is checked against the spec rather than against itself.
 */
const SPEC_CATALOGUE = {
  surveys: {
    name: "Surveys",
    category: "surveys",
    scopeFamily: "surveys",
    levels: ["none", "read", "write"],
  },
  creatives: {
    name: "Creatives",
    category: "surveys",
    scopeFamily: "surveys",
    levels: ["none", "read", "write"],
  },
  surveyStyling: {
    name: "Survey styling",
    category: "surveys",
    scopeFamily: "surveys",
    levels: ["none", "read", "write"],
  },
  responses: {
    name: "Responses",
    category: "responses",
    scopeFamily: "responses",
    levels: ["none", "read", "write"],
  },
  tags: { name: "Tags", category: "responses", scopeFamily: "responses", levels: ["none", "read", "write"] },
  workflows: {
    name: "Workflows",
    category: "workflows",
    scopeFamily: "workflows",
    levels: ["none", "read", "write"],
  },
  workflowRuns: {
    name: "Workflow runs",
    category: "workflows",
    scopeFamily: "workflows",
    levels: ["none", "read"],
  },
  charts: {
    name: "Charts",
    category: "dashboards",
    scopeFamily: "dashboards",
    levels: ["none", "read", "write"],
  },
  dashboards: {
    name: "Dashboards",
    category: "dashboards",
    scopeFamily: "dashboards",
    levels: ["none", "read", "write"],
  },
  feedbackRecords: {
    name: "Feedback records",
    category: "feedback",
    scopeFamily: "feedbackRecords",
    levels: ["none", "read", "write"],
  },
  feedbackDatasets: {
    name: "Feedback datasets",
    category: "feedback",
    scopeFamily: "feedbackRecords",
    levels: ["none", "read"],
  },
  contacts: { name: "Contacts", category: "audience", scopeFamily: "audience", levels: ["none", "read"] },
  contactAttributes: {
    name: "Contact attributes",
    category: "audience",
    scopeFamily: "audience",
    levels: ["none", "read"],
  },
  segments: { name: "Segments", category: "audience", scopeFamily: "audience", levels: ["none", "read"] },
  actionClasses: {
    name: "Action classes",
    category: "audience",
    scopeFamily: "audience",
    levels: ["none", "read"],
  },
};

describe("MCP permission registry", () => {
  test("lists every category from the spec's catalogue, in the order the matrix shows them", () => {
    expect(MCP_PERMISSION_CATEGORIES).toEqual([
      "surveys",
      "responses",
      "workflows",
      "dashboards",
      "feedback",
      "audience",
    ]);
  });

  test("defines every permission with its category, scope family and offered levels", () => {
    expect(MCP_PERMISSIONS).toEqual(SPEC_CATALOGUE);
  });

  test("every permission belongs to a listed category, and every category has a permission", () => {
    const used = new Set(Object.values(MCP_PERMISSIONS).map(({ category }) => category));
    expect([...used].sort()).toEqual([...MCP_PERMISSION_CATEGORIES].sort());
  });
});

describe("MCP_PERMISSION_DEPENDENCIES", () => {
  test("names, for each permission, other registered permissions at levels they offer", () => {
    for (const [permission, requirements] of Object.entries(MCP_PERMISSION_DEPENDENCIES)) {
      expect(Object.hasOwn(MCP_PERMISSIONS, permission)).toBe(true);
      for (const requirement of requirements ?? []) {
        expect(isMcpPermissionRequirement(requirement)).toBe(true);
        expect(requirement.permission).not.toBe(permission);
      }
    }
  });

  test("Charts needs Feedback records: Read", () => {
    expect(MCP_PERMISSION_DEPENDENCIES.charts).toEqual([{ permission: "feedbackRecords", level: "read" }]);
  });
});

describe("getMcpPermissionScope", () => {
  test("maps a permission at Read to its scope family's read scope", () => {
    expect(getMcpPermissionScope({ permission: "creatives", level: "read" })).toBe("surveys:read");
    expect(getMcpPermissionScope({ permission: "feedbackDatasets", level: "read" })).toBe(
      "feedbackRecords:read"
    );
  });

  test("maps a permission at Write to its scope family's write scope", () => {
    expect(getMcpPermissionScope({ permission: "charts", level: "write" })).toBe("dashboards:write");
    expect(getMcpPermissionScope({ permission: "tags", level: "write" })).toBe("responses:write");
  });
});

describe("isMcpPermissionRequirement", () => {
  test("accepts a known permission at a level it offers", () => {
    expect(isMcpPermissionRequirement({ permission: "surveys", level: "write" })).toBe(true);
    expect(isMcpPermissionRequirement({ permission: "workflowRuns", level: "read" })).toBe(true);
  });

  test("refuses No access, which gates on nothing", () => {
    expect(isMcpPermissionRequirement({ permission: "surveys", level: "none" })).toBe(false);
  });

  test("refuses a level the permission does not offer", () => {
    expect(isMcpPermissionRequirement({ permission: "workflowRuns", level: "write" })).toBe(false);
    expect(isMcpPermissionRequirement({ permission: "contacts", level: "write" })).toBe(false);
  });

  test("refuses an unknown permission or level", () => {
    expect(isMcpPermissionRequirement({ permission: "everything", level: "read" })).toBe(false);
    expect(isMcpPermissionRequirement({ permission: "surveys", level: "manage" })).toBe(false);
    // Inherited object keys are not permissions.
    expect(isMcpPermissionRequirement({ permission: "toString", level: "read" })).toBe(false);
    expect(isMcpPermissionRequirement(null)).toBe(false);
  });
});
