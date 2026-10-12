import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  canSaveVisibility,
  getDisplayedVisibility,
  getRestrictedAuthor,
  getVisibilityErrorReaction,
  groupBlockersByType,
  isVisibilityOptionDisabled,
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

  test("no author left, or no access known, is unknown", () => {
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

describe("isVisibilityOptionDisabled", () => {
  const blockers = [{ id: "i1", name: "Slack", type: "integration" as const }];

  test("a Restricted held back by connections stays selectable", () => {
    expect(
      isVisibilityOptionDisabled({
        value: "restricted",
        current: "workspace",
        state: { blockers, allowedTargets: ["workspace"] },
      })
    ).toBe(false);
  });

  test("a Restricted unavailable for another reason, e.g. no owner, is disabled", () => {
    expect(
      isVisibilityOptionDisabled({
        value: "restricted",
        current: "workspace",
        state: { blockers: [], allowedTargets: ["workspace"] },
      })
    ).toBe(true);
  });

  test("the current value and any allowed target are never disabled", () => {
    const state = { blockers: [], allowedTargets: ["restricted" as const] };
    expect(isVisibilityOptionDisabled({ value: "workspace", current: "workspace", state })).toBe(false);
    expect(isVisibilityOptionDisabled({ value: "restricted", current: "workspace", state })).toBe(false);
  });

  test("an unoffered Visible stays disabled even with blockers", () => {
    expect(
      isVisibilityOptionDisabled({
        value: "workspace",
        current: "restricted",
        state: { blockers, allowedTargets: [] },
      })
    ).toBe(true);
  });
});

describe("showBlockersInCollaborate", () => {
  const blockers = [{ id: "i1", name: "Slack", type: "integration" as const }];
  const blocked = { blockers, allowedTargets: ["workspace" as const] };

  test("shows the blockers once Restricted is picked on a survey connections hold visible", () => {
    expect(showBlockersInCollaborate({ selected: "restricted", current: "workspace", state: blocked })).toBe(
      true
    );
  });

  test("hides them while Visible is selected, the default", () => {
    expect(showBlockersInCollaborate({ selected: "workspace", current: "workspace", state: blocked })).toBe(
      false
    );
    expect(showBlockersInCollaborate({ selected: null, current: "workspace", state: blocked })).toBe(false);
  });

  test("never for Restricted unavailable without blockers, offered anyway, or already current", () => {
    expect(
      showBlockersInCollaborate({
        selected: "restricted",
        current: "workspace",
        state: { blockers: [], allowedTargets: ["workspace"] },
      })
    ).toBe(false);
    expect(
      showBlockersInCollaborate({
        selected: "restricted",
        current: "workspace",
        state: { blockers, allowedTargets: ["restricted", "workspace"] },
      })
    ).toBe(false);
    expect(showBlockersInCollaborate({ selected: "restricted", current: "restricted", state: blocked })).toBe(
      false
    );
  });

  test("Save stays off while the blocked Restricted is picked", () => {
    expect(
      canSaveVisibility({ current: "workspace", selected: "restricted", allowedTargets: ["workspace"] })
    ).toBe(false);
  });
});
