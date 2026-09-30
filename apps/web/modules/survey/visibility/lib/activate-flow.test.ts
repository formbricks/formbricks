import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { planActivation, shouldAskWhoCanView } from "./activate-flow";

const apiError = (status: number, code?: string) => new V3ApiError({ status, detail: "Nope", code });

describe("shouldAskWhoCanView", () => {
  const manager = { canManageVisibility: true };
  const manageable = { enforced: true, manageable: true } as const;
  const notEntitled = { enforced: true, manageable: false } as const;
  const notEnforced = { enforced: false, manageable: false } as const;

  test("asks for a restricted survey when the viewer can change its visibility", () => {
    expect(shouldAskWhoCanView({ gate: manageable, access: manager, visibility: "restricted" })).toBe(true);
  });

  test.each([
    [
      "the organization cannot change visibility (entitlement lost)",
      { gate: notEntitled, access: manager, visibility: "restricted" as const },
    ],
    ["visibility is not enforced", { gate: notEnforced, access: manager, visibility: "restricted" as const }],
    [
      "the survey is already visible",
      { gate: manageable, access: manager, visibility: "workspace" as const },
    ],
    [
      "the viewer cannot change it",
      { gate: manageable, access: { canManageVisibility: false }, visibility: "restricted" as const },
    ],
    ["access is unknown", { gate: manageable, access: null, visibility: "restricted" as const }],
  ])("activates as before when %s", (_label, input) => {
    expect(shouldAskWhoCanView(input)).toBe(false);
  });
});

describe("planActivation", () => {
  test("restricted activates directly, without touching visibility", () => {
    expect(planActivation("restricted")).toEqual({ kind: "activate", pending: false });
  });

  test("visible changes visibility first", () => {
    expect(planActivation("workspace")).toEqual({ kind: "change_visibility" });
  });

  test("visible activates once the change succeeded", () => {
    expect(planActivation("workspace", { ok: true })).toEqual({ kind: "activate", pending: false });
  });

  test("a pending grant does not block activation", () => {
    expect(planActivation("workspace", { ok: false, error: apiError(503, "projection_pending") })).toEqual({
      kind: "activate",
      pending: true,
    });
  });

  test("the feature being off stops and hides the controls", () => {
    expect(
      planActivation("workspace", { ok: false, error: apiError(403, "visibility_not_enabled") })
    ).toEqual({ kind: "abort", hideControls: true });
  });

  test.each([
    ["a generic 403", apiError(403, "forbidden")],
    ["a blocked change", apiError(409, "visibility_blocked_by_connections")],
    ["a server error", apiError(500)],
    ["a network failure", new Error("offline")],
  ])("%s stops without activating", (_label, error) => {
    expect(planActivation("workspace", { ok: false, error })).toEqual({ kind: "abort", hideControls: false });
  });
});
