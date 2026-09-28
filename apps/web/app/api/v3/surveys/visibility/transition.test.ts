import { describe, expect, test } from "vitest";
import {
  type TVisibilityTransitionRow,
  getAllowedVisibilityTargets,
  planVisibilityTransition,
} from "./transition";

const settled = (
  visibility: "private" | "workspace",
  ownerId: string | null = "owner"
): TVisibilityTransitionRow => ({
  ownerId,
  visibility,
  visibilityProjectedVersion: 2,
  visibilityVersion: 2,
});

/** A stored value the graph has not acknowledged yet. */
const pending = (
  visibility: "private" | "workspace",
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
    ["private → private is a no-op too", settled("private"), "private", 0, { kind: "noop" }],
    [
      "workspace → private is a change",
      settled("workspace"),
      "private",
      0,
      { kind: "change", to: "private" },
    ],
    [
      "private → workspace is a change with no precondition",
      settled("private", null),
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
      pending("private"),
      "private",
      0,
      { kind: "retry", to: "private" },
    ],
    [
      "the enforced value while a grant is pending cancels it",
      pending("workspace"),
      "private",
      0,
      { kind: "cancel", to: "private" },
    ],
    [
      "workspace while a restriction is pending cancels it",
      pending("private"),
      "workspace",
      0,
      { kind: "cancel", to: "workspace" },
    ],
  ] as const)("%s", (_label, row, requested, blockerCount, expected) => {
    expect(planVisibilityTransition({ blockerCount, requested, row })).toEqual(expected);
  });

  test("refuses private while outbound connections depend on the survey (409)", () => {
    expect(
      planVisibilityTransition({ blockerCount: 2, requested: "private", row: settled("workspace") })
    ).toEqual({
      code: "visibility_blocked_by_connections",
      kind: "reject",
      status: 409,
    });
  });

  test("refuses private for an ownerless survey (422)", () => {
    expect(
      planVisibilityTransition({ blockerCount: 0, requested: "private", row: settled("workspace", null) })
    ).toEqual({ code: "visibility_change_not_allowed", kind: "reject", status: 422 });
  });

  test("422 wins over 409: the missing owner cannot be fixed, so listing connections is a dead end", () => {
    expect(
      planVisibilityTransition({ blockerCount: 5, requested: "private", row: settled("workspace", null) })
    ).toMatchObject({ status: 422 });
  });

  test("cancelling a pending grant back to private is refused on the same grounds", () => {
    expect(
      planVisibilityTransition({ blockerCount: 1, requested: "private", row: pending("workspace") })
    ).toMatchObject({
      status: 409,
    });
    expect(
      planVisibilityTransition({ blockerCount: 0, requested: "private", row: pending("workspace", null) })
    ).toMatchObject({ status: 422 });
  });
});

describe("getAllowedVisibilityTargets", () => {
  test.each([
    ["a settled workspace-visible survey offers private", settled("workspace"), 0, ["private"]],
    ["blockers take private off the list", settled("workspace"), 1, []],
    ["an ownerless survey never offers private", settled("workspace", null), 0, []],
    ["a settled private survey offers workspace", settled("private"), 0, ["workspace"]],
    [
      "an ownerless private survey still offers workspace (the administrator's recovery)",
      settled("private", null),
      0,
      ["workspace"],
    ],
    ["a pending grant offers the retry and the cancel", pending("workspace"), 0, ["workspace", "private"]],
    [
      "a pending restriction offers the cancel and the retry",
      pending("private"),
      0,
      ["workspace", "private"],
    ],
  ] as const)("%s", (_label, row, blockerCount, expected) => {
    expect(getAllowedVisibilityTargets(row, blockerCount)).toEqual(expected);
  });
});
