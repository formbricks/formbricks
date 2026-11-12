import { describe, expect, test } from "vitest";
import {
  getMcpGrantAccessSummary,
  initialMcpGrantAccessDraft,
  isSameMcpGrantAccess,
  toMcpGrantAccessRequest,
  toMcpGrantAccessSelection,
} from "./grant-access";

const t = (key: string, values?: Record<string, string>) =>
  values ? `${key}(${JSON.stringify(values)})` : key;

describe("toMcpGrantAccessSelection", () => {
  test("All access selects nothing, whatever was picked before switching", () => {
    expect(
      toMcpGrantAccessSelection({ access: "all", organizationIds: ["org_1"], workspaceIds: ["ws_1"] })
    ).toEqual({ access: "all" });
  });

  test("a selection keeps only the picks of its own mode", () => {
    const draft = { organizationIds: ["org_1"], workspaceIds: ["ws_1", "ws_2"] };
    expect(toMcpGrantAccessSelection({ ...draft, access: "organizations" })).toEqual({
      access: "organizations",
      organizationIds: ["org_1"],
    });
    expect(toMcpGrantAccessSelection({ ...draft, access: "workspaces" })).toEqual({
      access: "workspaces",
      workspaceIds: ["ws_1", "ws_2"],
    });
  });

  test.each(["organizations", "workspaces"] as const)("%s with nothing picked can't be saved", (access) => {
    expect(toMcpGrantAccessSelection({ access, organizationIds: [], workspaceIds: [] })).toBeNull();
  });
});

describe("toMcpGrantAccessRequest", () => {
  test("names the access and only the matching ids", () => {
    expect(toMcpGrantAccessRequest({ access: "all" })).toEqual({ access: "all" });
    expect(toMcpGrantAccessRequest({ access: "workspaces", workspaceIds: ["ws_1"] })).toEqual({
      access: "workspaces",
      workspaceIds: ["ws_1"],
    });
  });
});

describe("initialMcpGrantAccessDraft", () => {
  test("opens a connection without a grant on All access", () => {
    expect(initialMcpGrantAccessDraft(null)).toEqual({
      access: "all",
      organizationIds: [],
      workspaceIds: [],
    });
  });

  test("opens with the grant's own access and picks", () => {
    expect(initialMcpGrantAccessDraft({ access: "workspaces", workspaceIds: ["ws_1"] })).toEqual({
      access: "workspaces",
      organizationIds: [],
      workspaceIds: ["ws_1"],
    });
  });
});

describe("isSameMcpGrantAccess", () => {
  test("ignores pick order", () => {
    expect(
      isSameMcpGrantAccess(
        { access: "workspaces", workspaceIds: ["ws_2", "ws_1"] },
        { access: "workspaces", workspaceIds: ["ws_1", "ws_2"] }
      )
    ).toBe(true);
  });

  test("tells a different mode or pick apart", () => {
    const saved = { access: "workspaces" as const, workspaceIds: ["ws_1"] };
    expect(isSameMcpGrantAccess({ access: "all" }, saved)).toBe(false);
    expect(isSameMcpGrantAccess({ access: "workspaces", workspaceIds: ["ws_2"] }, saved)).toBe(false);
  });
});

describe("getMcpGrantAccessSummary", () => {
  test.each([
    [{ access: "all" as const }, "auth.oauth.access.summary_all"],
    [
      { access: "organizations" as const, organizationIds: ["a", "b"] },
      'auth.oauth.access.summary_organizations({"count":"2"})',
    ],
    [
      { access: "workspaces" as const, workspaceIds: ["a", "b", "c"] },
      'auth.oauth.access.summary_workspaces({"count":"3"})',
    ],
    [{ access: "workspaces" as const, workspaceIds: ["a"] }, "auth.oauth.access.summary_one_workspace"],
    [
      { access: "organizations" as const, organizationIds: ["a"] },
      "auth.oauth.access.summary_one_organization",
    ],
    [{ access: "workspaces" as const, workspaceIds: [] }, "auth.oauth.access.summary_none"],
    [{ access: "organizations" as const, organizationIds: [] }, "auth.oauth.access.summary_none"],
  ])("summarizes %j", (grant, expected) => {
    expect(getMcpGrantAccessSummary(grant, t)).toBe(expected);
  });
});
