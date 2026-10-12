import { describe, expect, test } from "vitest";
import {
  type TVisibilityTransitionRow,
  getAllowedVisibilityTargets,
  planVisibilityTransition,
} from "./transition";

const settled = (
  visibility: "restricted" | "workspace",
  ownerId: string | null = "owner"
): TVisibilityTransitionRow => ({
  ownerId,
  visibility,
  visibilityProjectedVersion: 2,
  visibilityVersion: 2,
});

/** A stored value the graph has not acknowledged yet. */
const pending = (
  visibility: "restricted" | "workspace",
  ownerId: string | null = "owner"
): TVisibilityTransitionRow => ({
  ownerId,
  visibility,
  visibilityProjectedVersion: 2,
  visibilityVersion: 3,
});

describe("planVisibilityTransition (contract §3)", () => {
  test.each([
    [
      "the enforced value with nothing pending is a no-op",
      settled("workspace"),
      "workspace",
      0,
      { kind: "noop" },
    ],
    ["restricted → restricted is a no-op too", settled("restricted"), "restricted", 0, { kind: "noop" }],
    [
      "workspace → restricted is a change",
      settled("workspace"),
      "restricted",
      0,
      { kind: "change", to: "restricted" },
    ],
    [
      "restricted → workspace is a change with no precondition",
      settled("restricted", null),
      "workspace",
      3,
      { kind: "change", to: "workspace" },
    ],
    [
      "requesting the pending grant again retries it",
      pending("workspace"),
      "workspace",
      0,
      { kind: "retry", to: "workspace" },
    ],
    [
      "requesting the pending restriction again retries it",
      pending("restricted"),
      "restricted",
      0,
      { kind: "retry", to: "restricted" },
    ],
    [
      "the enforced value while a grant is pending cancels it",
      pending("workspace"),
      "restricted",
      0,
      { kind: "cancel", to: "restricted" },
    ],
    [
      "workspace while a restriction is pending cancels it",
      pending("restricted"),
      "workspace",
      0,
      { kind: "cancel", to: "workspace" },
    ],
  ] as const)("%s", (_label, row, requested, blockerCount, expected) => {
    expect(planVisibilityTransition({ blockerCount, requested, row })).toEqual(expected);
  });

  test("refuses restricted while outbound connections depend on the survey (409)", () => {
    expect(
      planVisibilityTransition({ blockerCount: 2, requested: "restricted", row: settled("workspace") })
    ).toEqual({
      code: "visibility_blocked_by_connections",
      kind: "reject",
      status: 409,
    });
  });

  test("refuses restricted for an ownerless survey (422)", () => {
    expect(
      planVisibilityTransition({ blockerCount: 0, requested: "restricted", row: settled("workspace", null) })
    ).toEqual({ code: "visibility_change_not_allowed", kind: "reject", status: 422 });
  });

  test("422 wins over 409: the missing owner cannot be fixed, so listing connections is a dead end", () => {
    expect(
      planVisibilityTransition({ blockerCount: 5, requested: "restricted", row: settled("workspace", null) })
    ).toMatchObject({ status: 422 });
  });

  test("cancelling a pending grant back to restricted is refused on the same grounds", () => {
    expect(
      planVisibilityTransition({ blockerCount: 1, requested: "restricted", row: pending("workspace") })
    ).toMatchObject({
      status: 409,
    });
    expect(
      planVisibilityTransition({ blockerCount: 0, requested: "restricted", row: pending("workspace", null) })
    ).toMatchObject({ status: 422 });
  });
});

describe("getAllowedVisibilityTargets", () => {
  test.each([
    ["a settled workspace-visible survey offers restricted", settled("workspace"), 0, ["restricted"]],
    ["blockers take restricted off the list", settled("workspace"), 1, []],
    ["an ownerless survey never offers restricted", settled("workspace", null), 0, []],
    ["a settled restricted survey offers workspace", settled("restricted"), 0, ["workspace"]],
    [
      "an ownerless restricted survey still offers workspace (the administrator's recovery)",
      settled("restricted", null),
      0,
      ["workspace"],
    ],
    ["a pending grant offers the retry and the cancel", pending("workspace"), 0, ["workspace", "restricted"]],
    [
      "a pending restriction offers the cancel and the retry",
      pending("restricted"),
      0,
      ["workspace", "restricted"],
    ],
  ] as const)("%s", (_label, row, blockerCount, expected) => {
    expect(getAllowedVisibilityTargets(row, blockerCount)).toEqual(expected);
  });
});
