import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  canSaveVisibility,
  getDisplayedVisibility,
  getRestrictedAuthor,
  getVisibilityErrorReaction,
  groupBlockersByType,
  needsRestrictConfirmation,
  showBlockersInCollaborate,
} from "./collaborate";

const apiError = (status: number, code?: string) => new V3ApiError({ status, detail: "Nope", code });

describe("getDisplayedVisibility", () => {
  test.each([
    [{ visibility: "workspace" as const, pending: null }, "workspace"],
    [{ visibility: "restricted" as const, pending: null }, "restricted"],
    [{ visibility: "restricted" as const, pending: "workspace" as const }, "restricted"],
    [{ visibility: "workspace" as const, pending: "restricted" as const }, "restricted"],
  ])("%o → %s", (state, expected) => {
    expect(getDisplayedVisibility(state)).toBe(expected);
  });
});

describe("canSaveVisibility", () => {
  const both = ["restricted", "workspace"] as const;

  test("needs a different, allowed selection", () => {
    expect(canSaveVisibility({ current: "restricted", selected: "workspace", allowedTargets: both })).toBe(
      true
    );
  });

  test("not without a selection", () => {
    expect(canSaveVisibility({ current: "restricted", selected: null, allowedTargets: both })).toBe(false);
  });

  test("not for the current value", () => {
    expect(canSaveVisibility({ current: "workspace", selected: "workspace", allowedTargets: both })).toBe(
      false
    );
  });

  test("not for a target the server would refuse", () => {
    expect(
      canSaveVisibility({ current: "workspace", selected: "restricted", allowedTargets: ["workspace"] })
    ).toBe(false);
  });
});

describe("needsRestrictConfirmation", () => {
  test("restricting confirms, making visible does not", () => {
    expect(needsRestrictConfirmation("restricted")).toBe(true);
    expect(needsRestrictConfirmation("workspace")).toBe(false);
  });
});

describe("getVisibilityErrorReaction", () => {
  test.each([
    [apiError(503, "projection_pending"), "pending"],
    [apiError(403, "visibility_not_enabled"), "hide_controls"],
    [apiError(409, "visibility_blocked_by_connections"), "refetch_blockers"],
    [apiError(422, "visibility_change_not_allowed"), "show_error"],
    [apiError(403, "forbidden"), "show_error"],
    [new Error("offline"), "show_error"],
  ])("%#: maps to %s", (error, expected) => {
    expect(getVisibilityErrorReaction(error)).toBe(expected);
  });
});

describe("getRestrictedAuthor", () => {
  test("the author reads You", () => {
    expect(getRestrictedAuthor({ via: "owner" }, "Ada")).toEqual({ kind: "you" });
  });

  test.each([["organizationRole"], ["workspace"]])("via %s names the author", (via) => {
    expect(getRestrictedAuthor({ via }, "Ada")).toEqual({ kind: "named", name: "Ada" });
  });

  test("no author left, or no access known, reads The author", () => {
    expect(getRestrictedAuthor({ via: "organizationRole" }, null)).toEqual({ kind: "unknown" });
    expect(getRestrictedAuthor(null, null)).toEqual({ kind: "unknown" });
  });
});

describe("groupBlockersByType", () => {
  test("groups by type in a fixed order with sorted names, dropping empty groups", () => {
    expect(
      groupBlockersByType([
        { id: "w2", name: "Zapier", type: "webhook" },
        { id: "d1", name: "Board", type: "dashboard" },
        { id: "w1", name: "n8n", type: "webhook" },
        { id: "f1", name: "Inbox", type: "feedbackSource" },
      ])
    ).toEqual([
      { type: "feedbackSource", names: ["Inbox"] },
      { type: "webhook", names: ["n8n", "Zapier"] },
      { type: "dashboard", names: ["Board"] },
    ]);
  });

  test("no blockers, no groups", () => {
    expect(groupBlockersByType([])).toEqual([]);
  });
});

describe("showBlockersInCollaborate", () => {
  const blockers = [{ id: "i1", name: "Slack", type: "integration" as const }];

  test("explains a Restricted option held back by connections on a workspace-visible survey", () => {
    expect(showBlockersInCollaborate("workspace", { blockers, allowedTargets: [] })).toBe(true);
  });

  test("stays quiet without blockers, e.g. Unavailable because the survey has no owner", () => {
    expect(showBlockersInCollaborate("workspace", { blockers: [], allowedTargets: [] })).toBe(false);
  });

  test("stays quiet when Restricted is offered anyway, or the survey is already restricted", () => {
    expect(showBlockersInCollaborate("workspace", { blockers, allowedTargets: ["restricted"] })).toBe(false);
    expect(showBlockersInCollaborate("restricted", { blockers, allowedTargets: [] })).toBe(false);
    expect(showBlockersInCollaborate(null, { blockers, allowedTargets: [] })).toBe(false);
  });
});
