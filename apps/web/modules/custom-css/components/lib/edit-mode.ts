import { type TCustomCssChangeKind } from "./draft";
import { type TCustomCssValidationStatus } from "./validation";

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
 * What the Appearance page's single Save does with the workspace CSS draft (ENG-3723):
 * - `skip`: nothing this role or plan may save — an unchanged draft, a read-only role, or anything but
 *   a removal without the plan. The theme still saves.
 * - `block`: the draft is known to be invalid, so the whole Save stops and the theme waits with it.
 * - `submit`: everything else, including a draft whose check is still running; the server checks it
 *   again either way, as the survey editor's manual save does.
 */
export type TWorkspaceCssSaveStep = "skip" | "block" | "submit";

export const getWorkspaceCssSaveStep = (params: {
  mode: TCustomCssEditMode;
  changeKind: TCustomCssChangeKind;
  status: TCustomCssValidationStatus;
}): TWorkspaceCssSaveStep => {
  if (params.mode === "read-only" || params.changeKind === "unchanged") return "skip";
  if (params.mode === "clear-only" && params.changeKind !== "removal") return "skip";
  return params.status === "invalid" ? "block" : "submit";
};
