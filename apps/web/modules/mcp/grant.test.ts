import { describe, expect, test } from "vitest";
import {
  capMcpGrantPermissions,
  getMcpGrantPermissionsForScopes,
  isMcpGrantWithinCap,
  parseRequestedMcpGrant,
  readMcpGrantAccessSelection,
} from "./grant";

describe("capMcpGrantPermissions", () => {
  test("keeps each level the scopes allow and lowers the ones above them", () => {
    const cap = getMcpGrantPermissionsForScopes(["surveys:read", "responses:write"]);

    expect(
      capMcpGrantPermissions({ surveys: "write", creatives: "read", responses: "write", tags: "read" }, cap)
    ).toEqual({ surveys: "read", creatives: "read", responses: "write", tags: "read" });
  });

  test("drops a permission whose scope family the client did not ask for", () => {
    const cap = getMcpGrantPermissionsForScopes(["surveys:write"]);

    expect(capMcpGrantPermissions({ surveys: "write", workflows: "write", contacts: "read" }, cap)).toEqual({
      surveys: "write",
    });
  });

  test("gives nothing when the client asked for no MCP scope", () => {
    const cap = getMcpGrantPermissionsForScopes(["openid", "profile", "email", "offline_access"]);

    expect(capMcpGrantPermissions({ surveys: "write", dashboards: "read" }, cap)).toEqual({});
  });
});

describe("isMcpGrantWithinCap", () => {
  const cap = getMcpGrantPermissionsForScopes(["surveys:read", "responses:write"]);

  test("accepts a grant at or below every level the scopes allow", () => {
    expect(isMcpGrantWithinCap({ surveys: "read", responses: "write", tags: "read" }, cap)).toBe(true);
  });

  test("refuses a level above what the scopes allow", () => {
    expect(isMcpGrantWithinCap({ surveys: "write" }, cap)).toBe(false);
  });

  test("refuses a permission whose scope family the client did not ask for", () => {
    expect(isMcpGrantWithinCap({ responses: "read", workflows: "read" }, cap)).toBe(false);
  });
});

describe("parseRequestedMcpGrant", () => {
  test("reads the permissions a consent request chose, leaving organization & workspace access unsaid", () => {
    expect(parseRequestedMcpGrant({ permissions: { surveys: "write", workflowRuns: "read" } })).toEqual({
      permissions: { surveys: "write", workflowRuns: "read" },
    });
  });

  test.each([
    ["All access", { access: "all" }, { access: "all" }],
    [
      "Only selected organizations",
      { access: "organizations", organizationIds: ["org_b", "org_a", "org_b"] },
      { access: "organizations", organizationIds: ["org_a", "org_b"] },
    ],
    [
      "Only selected workspaces",
      { access: "workspaces", workspaceIds: ["ws_1"] },
      { access: "workspaces", workspaceIds: ["ws_1"] },
    ],
  ])("reads %s", (_case, access, expected) => {
    expect(parseRequestedMcpGrant({ permissions: { surveys: "read" }, ...access })).toEqual({
      permissions: { surveys: "read" },
      access: expected,
    });
  });

  test.each([
    ["no permission given", { permissions: {} }],
    ["an unknown permission", { permissions: { surveys: "read", everything: "write" } }],
    ["a level the permission doesn't offer", { permissions: { workflowRuns: "write" } }],
    ["No access spelled out", { permissions: { surveys: "none" } }],
    ["an inherited key", { permissions: JSON.parse('{"__proto__": "write", "surveys": "read"}') as object }],
    ["an extra field", { permissions: { surveys: "read" }, scopes: "all" }],
    ["an unknown access", { permissions: { surveys: "read" }, access: "everything" }],
    ["no workspace picked", { permissions: { surveys: "read" }, access: "workspaces", workspaceIds: [] }],
    [
      "no organization picked",
      { permissions: { surveys: "read" }, access: "organizations", organizationIds: [] },
    ],
    [
      "workspaces sent with organizations access",
      { permissions: { surveys: "read" }, access: "organizations", workspaceIds: ["ws_1"] },
    ],
    ["ids sent with All access", { permissions: { surveys: "read" }, access: "all", workspaceIds: ["ws_1"] }],
    ["ids without an access", { permissions: { surveys: "read" }, workspaceIds: ["ws_1"] }],
    [
      "an id that is not a string",
      { permissions: { surveys: "read" }, access: "workspaces", workspaceIds: [42] },
    ],
    [
      "more selections than a grant holds",
      {
        permissions: { surveys: "read" },
        access: "workspaces",
        workspaceIds: Array.from({ length: 501 }, (_, i) => `ws_${i}`),
      },
    ],
    ["no permissions field", {}],
    ["a string", "surveys:write"],
    ["null", null],
  ])("refuses %s", (_case, value) => {
    expect(parseRequestedMcpGrant(value)).toBeNull();
  });
});

describe("readMcpGrantAccessSelection", () => {
  test("reads only the selection the grant's mode reads", () => {
    const rows = { organizations: [{ organizationId: "org-1" }], workspaces: [{ workspaceId: "ws-1" }] };

    expect(readMcpGrantAccessSelection({ ...rows, access: "all" })).toEqual({ access: "all" });
    expect(readMcpGrantAccessSelection({ ...rows, access: "organizations" })).toEqual({
      access: "organizations",
      organizationIds: ["org-1"],
    });
    expect(readMcpGrantAccessSelection({ ...rows, access: "workspaces" })).toEqual({
      access: "workspaces",
      workspaceIds: ["ws-1"],
    });
  });
});
