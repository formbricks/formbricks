import { describe, expect, test } from "vitest";
import {
  MCP_PERMISSIONS,
  MCP_PERMISSION_CATEGORIES,
  getMcpPermissionScope,
  isMcpPermissionRequirement,
} from "./permissions";

/**
 * The permission catalogue from the engineering spec (P-ENG-103, "5. Engineering spec"), written out by
 * hand so the registry is checked against the spec rather than against itself.
 */
const SPEC_CATALOGUE = {
  surveys: { category: "surveys", scopeFamily: "surveys", levels: ["none", "read", "write"] },
  creatives: { category: "surveys", scopeFamily: "surveys", levels: ["none", "read", "write"] },
  surveyStyling: { category: "surveys", scopeFamily: "surveys", levels: ["none", "read", "write"] },
  responses: { category: "responses", scopeFamily: "responses", levels: ["none", "read", "write"] },
  tags: { category: "responses", scopeFamily: "responses", levels: ["none", "read", "write"] },
  workflows: { category: "workflows", scopeFamily: "workflows", levels: ["none", "read", "write"] },
  workflowRuns: { category: "workflows", scopeFamily: "workflows", levels: ["none", "read"] },
  charts: { category: "dashboards", scopeFamily: "dashboards", levels: ["none", "read", "write"] },
  dashboards: { category: "dashboards", scopeFamily: "dashboards", levels: ["none", "read", "write"] },
  feedbackRecords: {
    category: "feedback",
    scopeFamily: "feedbackRecords",
    levels: ["none", "read", "write"],
  },
  feedbackDatasets: { category: "feedback", scopeFamily: "feedbackRecords", levels: ["none", "read"] },
  contacts: { category: "audience", scopeFamily: "audience", levels: ["none", "read"] },
  contactAttributes: { category: "audience", scopeFamily: "audience", levels: ["none", "read"] },
  segments: { category: "audience", scopeFamily: "audience", levels: ["none", "read"] },
  actionClasses: { category: "audience", scopeFamily: "audience", levels: ["none", "read"] },
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
