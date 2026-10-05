import { type TCustomCssChangeKind } from "./draft";
import { type TCustomCssValidationStatus, canSaveCustomCssDraft } from "./validation";

/**
 * What the creator may do with the CSS fields (ENG-2949, M4.4):
 * - `full`: type, upload, clear and save.
 * - `clear-only`: a Cloud organization without Scale. Saved CSS stays applied and visible; the only
 *   change allowed is clearing a field or all of it, which the server also accepts without Scale.
 * - `read-only`: the role cannot change this CSS at all.
 */
export type TCustomCssEditMode = "full" | "clear-only" | "read-only";

export const getCustomCssEditMode = (params: {
  canEdit: boolean;
  planAllowed: boolean;
}): TCustomCssEditMode => {
  if (!params.canEdit) return "read-only";
  return params.planAllowed ? "full" : "clear-only";
};

/**
 * Whether the current draft can be submitted. An unchanged draft has nothing to save, `clear-only`
 * may only submit a removal, and a draft the server would reject (invalid, or not yet checked) waits.
 * An empty draft needs no check: clearing everything is always valid.
 */
export const canSubmitCustomCssDraft = (params: {
  mode: TCustomCssEditMode;
  changeKind: TCustomCssChangeKind;
  status: TCustomCssValidationStatus;
}): boolean => {
  if (params.mode === "read-only" || params.changeKind === "unchanged") return false;
  if (params.mode === "clear-only" && params.changeKind !== "removal") return false;
  return canSaveCustomCssDraft(params.status);
};
