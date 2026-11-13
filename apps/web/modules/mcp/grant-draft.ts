import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "./grant";
import { type TMcpGrantAccessDraft, isSameMcpGrantAccess, toMcpGrantAccessSelection } from "./grant-access";
import { isMcpGrantEmpty, isSameMcpGrant } from "./grant-editor";

/**
 * A grant being chosen (ENG-7150, ENG-7152, ENG-7153): its permissions and its organization & workspace
 * access, as the consent screen and Authorized apps' Edit both hold it. Pure, so the rule both share is
 * unit-tested here rather than through their components.
 */

export type TMcpGrantDraft = { permissions: TMcpGrantPermissions; access: TMcpGrantAccessDraft };

/** The grant Edit opened with; the consent screen has none to compare against. */
export type TMcpSavedGrant = { permissions: TMcpGrantPermissions; access: TMcpGrantAccessSelection };

export type TMcpGrantDraftState = {
  /** The draft gives no permission: shown as a hint, and it can't be submitted. */
  isEmpty: boolean;
  /** The access the draft saves, or `null` for a selection with nothing picked. */
  accessSelection: TMcpGrantAccessSelection | null;
  /** Whether Allow (consent) or Save (Edit) is enabled. */
  canSubmit: boolean;
};

/**
 * What the draft submits and whether it may: never a grant that gives nothing, nor a selection with
 * nothing picked. Against a saved grant (Edit), also never one that changes nothing.
 */
export const getMcpGrantDraftState = (
  draft: TMcpGrantDraft,
  saved: TMcpSavedGrant | null
): TMcpGrantDraftState => {
  const isEmpty = isMcpGrantEmpty(draft.permissions);
  const accessSelection = toMcpGrantAccessSelection(draft.access);
  const changed =
    saved === null ||
    !isSameMcpGrant(draft.permissions, saved.permissions) ||
    (accessSelection !== null && !isSameMcpGrantAccess(accessSelection, saved.access));
  return { isEmpty, accessSelection, canSubmit: !isEmpty && accessSelection !== null && changed };
};
