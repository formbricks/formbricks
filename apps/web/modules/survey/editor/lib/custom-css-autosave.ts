import type { TCustomCssValidationStatus } from "@/modules/custom-css/components/lib/validation";

/**
 * The survey the editor autosaves (ENG-3553). The working copy goes out as is only when its Custom CSS
 * draft is known to be storable — checked and valid, or no CSS at all. While the check is debouncing or
 * in flight (`pending`), when it failed (`invalid`) or could not run (`unavailable`), the last saved CSS
 * takes the draft's place: an unchecked draft could be invalid, and invalid CSS fails the whole
 * autosave. The survey's other edits still save, the draft stays in the editor, and the leave-page
 * check still counts it as unsaved.
 */
export const getSurveyToAutosave = <TSurvey extends { customCss?: unknown }>(
  workingCopy: TSurvey,
  lastSaved: Readonly<{ customCss?: unknown }>,
  customCssStatus: TCustomCssValidationStatus
): TSurvey =>
  customCssStatus === "valid" || customCssStatus === "empty"
    ? workingCopy
    : { ...workingCopy, customCss: lastSaved.customCss };

/**
 * Whether a manual Save or Publish has to stop for the Custom CSS draft: only when it is known to be
 * invalid. A pending or unchecked draft is sent, since the server validates every save again and keeps
 * the stored revision when it fails.
 */
export const isCustomCssBlockingManualSave = (customCssStatus: TCustomCssValidationStatus): boolean =>
  customCssStatus === "invalid";
