/** Why a copy has no custom CSS although its source had some (ENG-2949). */
export type TSurveyCopyCustomCssNotice = "plan_required" | "invalid_css";

/** A survey copied into a workspace, as the survey list and the summary's Duplicate read it. */
export type TSurveyCopyResource = {
  id: string;
  workspaceId: string;
  /** Absent when the copy carries its source's custom CSS, or the source had none. */
  customCssNotice?: TSurveyCopyCustomCssNotice;
};

export const serializeSurveyCopy = (copy: {
  id: string;
  workspaceId: string;
  customCssNotice?: TSurveyCopyCustomCssNotice;
}): TSurveyCopyResource => ({
  id: copy.id,
  workspaceId: copy.workspaceId,
  ...(copy.customCssNotice ? { customCssNotice: copy.customCssNotice } : {}),
});
