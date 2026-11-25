import { describe, expect, test } from "vitest";
import { ZMcpSurveyVisibilityChangeOutput, ZMcpSurveyVisibilityStateOutput } from "./survey-output-schemas";

/**
 * The visibility output schemas are hand-typed from the v3 contract (its components are named but not in
 * the generated Zod bundle). These fixtures are the contract's own examples; a rename or a new blocker
 * type in `docs/api-v3-reference/openapi.yml` must be reflected here.
 */

const state = {
  id: "clsv2234567890123456789012",
  visibility: "workspace",
  owner: { name: "Alice Example" },
  access: { via: "workspace", canManageVisibility: true },
  blockers: [
    { type: "webhook", id: "clwh1234567890123456789012", name: "Zapier — new responses" },
    { type: "workflow", id: "clwf1234567890123456789012", name: "Notify #product" },
  ],
  impact: { memberCount: 7, responseCount: 212 },
  pending: null,
  version: 2,
  allowedTargets: [],
};

describe("ZMcpSurveyVisibilityStateOutput", () => {
  test("parses the contract's workspace-with-blockers example", () => {
    expect(ZMcpSurveyVisibilityStateOutput.safeParse({ data: state, requestId: "req_1" }).success).toBe(true);
  });

  test("parses a pending grant and its allowed targets", () => {
    expect(
      ZMcpSurveyVisibilityStateOutput.safeParse({
        data: {
          ...state,
          visibility: "restricted",
          owner: null,
          access: { via: "organizationRole", canManageVisibility: true },
          blockers: [],
          pending: "workspace",
          version: 3,
          allowedTargets: ["workspace"],
        },
        requestId: "req_1",
      }).success
    ).toBe(true);
  });

  test("rejects a state without blockers", () => {
    const { blockers: _blockers, ...withoutBlockers } = state;
    expect(ZMcpSurveyVisibilityStateOutput.safeParse({ data: withoutBlockers }).success).toBe(false);
  });

  test("parses an unknown blocker type and access path, which the contract keeps open", () => {
    expect(
      ZMcpSurveyVisibilityStateOutput.safeParse({
        data: {
          ...state,
          access: { via: "namedPerson", canManageVisibility: true },
          blockers: [{ ...state.blockers[0], type: "webform" }],
        },
      }).success
    ).toBe(true);
  });
});

describe("ZMcpSurveyVisibilityChangeOutput", () => {
  test("parses the contract's change result", () => {
    expect(
      ZMcpSurveyVisibilityChangeOutput.safeParse({
        data: {
          id: state.id,
          visibility: "workspace",
          owner: { name: "Alice Example" },
          access: { via: "owner", canManageVisibility: true },
          version: 3,
          pending: null,
          changedAt: "2026-11-24T10:00:00.000Z",
          changedBy: { type: "user", id: "user_1", name: "Alice Example" },
        },
        requestId: "req_1",
      }).success
    ).toBe(true);
  });

  test("rejects a changedBy that is not a user, and a missing version", () => {
    const data = {
      id: state.id,
      visibility: "workspace",
      owner: null,
      access: { via: "workspace", canManageVisibility: true },
      version: 3,
      pending: null,
      changedAt: null,
      changedBy: { type: "apiKey", id: "key_1", name: "Key" },
    };
    expect(ZMcpSurveyVisibilityChangeOutput.safeParse({ data }).success).toBe(false);
    const { version: _version, ...withoutVersion } = data;
    expect(ZMcpSurveyVisibilityChangeOutput.safeParse({ data: withoutVersion }).success).toBe(false);
  });
});
