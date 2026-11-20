import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getMcpGrantDraftState } from "@/modules/mcp/grant-draft";
import { getMcpGrantSaveFailure, isStaleMcpGrantEditError, openMcpGrantEdit } from "./edit-grant";

const OPENED_AT = "2026-06-01T10:00:00.123Z";

const t = (key: string) => `t:${key}`;

describe("openMcpGrantEdit", () => {
  // Scopes narrowed after the grant was saved (Surveys was Write, the client now asks for Read only), or
  // the user became a Dashboard viewer: the dialog must still be able to save an access-only change.
  test("opens on the stored grant held to the cap, so a save never carries a level the matrix hides", () => {
    const opening = openMcpGrantEdit({
      permissions: { surveys: "write", responses: "read" },
      access: { access: "all" },
      cap: { surveys: "read", responses: "write" },
      grantUpdatedAt: OPENED_AT,
    });

    expect(opening.initial.permissions).toEqual({ surveys: "read", responses: "read" });
    expect(opening.saved).toEqual({
      permissions: { surveys: "read", responses: "read" },
      access: { access: "all" },
    });

    // An access-only change saves the clamped permissions, within the cap the route checks.
    const state = getMcpGrantDraftState(
      {
        permissions: opening.initial.permissions,
        access: { ...opening.initial.access, access: "workspaces", workspaceIds: ["ws-1"] },
      },
      opening.saved
    );
    expect(state.canSubmit).toBe(true);
    expect(state.accessSelection).toEqual({ access: "workspaces", workspaceIds: ["ws-1"] });
  });

  test("opens with Save disabled: the clamped draft is what it is compared against", () => {
    const opening = openMcpGrantEdit({
      permissions: { surveys: "write" },
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
      cap: { surveys: "read" },
      grantUpdatedAt: OPENED_AT,
    });

    expect(opening.initial.access).toEqual({
      access: "workspaces",
      organizationIds: [],
      workspaceIds: ["ws-1"],
    });
    expect(getMcpGrantDraftState(opening.initial, opening.saved).canSubmit).toBe(false);
  });

  test("captures the grant version it opened, for the 409 check", () => {
    expect(
      openMcpGrantEdit({ permissions: {}, access: { access: "all" }, cap: {}, grantUpdatedAt: OPENED_AT })
        .expectedUpdatedAt
    ).toBe(OPENED_AT);
  });
});

const refusal = (status: number, code: string) => new V3ApiError({ status, code, detail: "English detail" });

describe("getMcpGrantSaveFailure", () => {
  test.each([
    [
      "the grant changed elsewhere",
      refusal(409, "mcp_grant_changed"),
      "t:auth.oauth.grant_changed_elsewhere",
    ],
    [
      "the client's scopes narrowed",
      refusal(422, "mcp_grant_beyond_scopes"),
      "t:auth.oauth.grant_beyond_scopes",
    ],
    [
      "a pick the user lost",
      refusal(422, "mcp_grant_selection_unavailable"),
      "t:auth.oauth.consent_grant_selection_unavailable",
    ],
  ])("closes the dialog when %s, with the translated reason", (_case, error, message) => {
    expect(isStaleMcpGrantEditError(error)).toBe(true);
    expect(getMcpGrantSaveFailure(error, t)).toEqual({ message, closeDialog: true });
  });

  test("keeps the dialog open on a save that failed, to try again", () => {
    expect(getMcpGrantSaveFailure(refusal(500, "mcp_grant_not_saved"), t)).toEqual({
      message: "t:auth.oauth.consent_grant_not_saved",
      closeDialog: false,
    });
  });

  test("falls back to the generic failure, never the server's English detail", () => {
    expect(getMcpGrantSaveFailure(refusal(500, "internal_server_error"), t)).toEqual({
      message: "t:auth.oauth.grant_update_failed",
      closeDialog: false,
    });
    expect(getMcpGrantSaveFailure(new TypeError("Failed to fetch"), t)).toEqual({
      message: "t:auth.oauth.grant_update_failed",
      closeDialog: false,
    });
  });
});
