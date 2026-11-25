import { describe, expect, expectTypeOf, test } from "vitest";
import type { z } from "zod";
import type { TSurveyVisibilityBlocker } from "@/app/api/v3/surveys/visibility/blockers";
import type { TV3SurveyVisibilityChangeResult } from "@/app/api/v3/surveys/visibility/operations";
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
      changedAt: "2026-11-24T10:00:00.000Z",
      changedBy: { type: "user", id: "user_1", name: "Alice Example" },
    };
    // Each case breaks one field of an otherwise valid result, so it fails for that field alone.
    expect(ZMcpSurveyVisibilityChangeOutput.safeParse({ data }).success).toBe(true);
    expect(
      ZMcpSurveyVisibilityChangeOutput.safeParse({
        data: { ...data, changedBy: { type: "apiKey", id: "key_1", name: "Key" } },
      }).success
    ).toBe(false);
    const { version: _version, ...withoutVersion } = data;
    expect(ZMcpSurveyVisibilityChangeOutput.safeParse({ data: withoutVersion }).success).toBe(false);
  });
});

// The hand-typed schemas are also pinned to the server's own types, so a serializer change breaks the
// typecheck rather than only the MCP call at runtime.
describe("visibility output schemas against the server types", () => {
  test("the change result and a blocker fit what the tools advertise", () => {
    type TChangeData = NonNullable<z.input<typeof ZMcpSurveyVisibilityChangeOutput>["data"]>;
    type TStateBlocker = NonNullable<
      z.input<typeof ZMcpSurveyVisibilityStateOutput>["data"]
    >["blockers"][number];

    expectTypeOf<TV3SurveyVisibilityChangeResult>().toExtend<TChangeData>();
    expectTypeOf<TSurveyVisibilityBlocker>().toExtend<TStateBlocker>();
  });
});
