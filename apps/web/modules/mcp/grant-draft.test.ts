import { describe, expect, test } from "vitest";
import type { TMcpGrantAccessDraft } from "./grant-access";
import { type TMcpSavedGrant, getMcpGrantDraftState } from "./grant-draft";

const ALL: TMcpGrantAccessDraft = { access: "all", organizationIds: [], workspaceIds: [] };
const ONE_WORKSPACE: TMcpGrantAccessDraft = {
  access: "workspaces",
  organizationIds: [],
  workspaceIds: ["ws_1"],
};
const NOTHING_PICKED: TMcpGrantAccessDraft = {
  access: "workspaces",
  organizationIds: ["org_1"],
  workspaceIds: [],
};

describe("getMcpGrantDraftState on the consent screen (no saved grant)", () => {
  test("allows a grant that gives something, with the access it saves", () => {
    expect(getMcpGrantDraftState({ permissions: { surveys: "read" }, access: ONE_WORKSPACE }, null)).toEqual({
      isEmpty: false,
      accessSelection: { access: "workspaces", workspaceIds: ["ws_1"] },
      canSubmit: true,
    });
  });

  test("refuses a grant with no permission, and says it is empty", () => {
    expect(getMcpGrantDraftState({ permissions: {}, access: ALL }, null)).toMatchObject({
      isEmpty: true,
      canSubmit: false,
    });
  });

  test("refuses a selection with nothing picked", () => {
    expect(
      getMcpGrantDraftState({ permissions: { surveys: "read" }, access: NOTHING_PICKED }, null)
    ).toMatchObject({ isEmpty: false, accessSelection: null, canSubmit: false });
  });
});

describe("getMcpGrantDraftState on Edit (against the saved grant)", () => {
  const saved: TMcpSavedGrant = {
    permissions: { surveys: "write", responses: "read" },
    access: { access: "workspaces", workspaceIds: ["ws_1"] },
  };

  test("disables Save while nothing changed, whatever order the levels were set in", () => {
    expect(
      getMcpGrantDraftState(
        { permissions: { responses: "read", surveys: "write" }, access: { ...ONE_WORKSPACE } },
        saved
      )
    ).toMatchObject({ isEmpty: false, canSubmit: false });
  });

  test("lets a changed permission be saved", () => {
    expect(
      getMcpGrantDraftState(
        { permissions: { surveys: "read", responses: "read" }, access: ONE_WORKSPACE },
        saved
      ).canSubmit
    ).toBe(true);
  });

  test("lets a changed access be saved with the same permissions", () => {
    expect(getMcpGrantDraftState({ permissions: saved.permissions, access: ALL }, saved).canSubmit).toBe(
      true
    );
  });

  test("disables Save on an empty grant, since Revoke is how access ends", () => {
    expect(getMcpGrantDraftState({ permissions: {}, access: ALL }, saved)).toMatchObject({
      isEmpty: true,
      canSubmit: false,
    });
  });

  test("disables Save on a selection with nothing picked, even though it changed", () => {
    expect(
      getMcpGrantDraftState({ permissions: saved.permissions, access: NOTHING_PICKED }, saved).canSubmit
    ).toBe(false);
  });
});
