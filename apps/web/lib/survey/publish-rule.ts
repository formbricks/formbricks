import type { TSurveyStatus, TSurveyType } from "@formbricks/types/surveys/types";

/**
 * The publish rule for app surveys, in one copy that every writer shares: the server's create and update,
 * the v3 PATCH and the survey editor's own check (client-safe on purpose, so the editor never promises a
 * save the API then refuses).
 *
 * A live (non-draft) app survey needs something that can show it: a trigger of its own, or a
 * non-archived creative that opens it (ENG-3914 T6, ENG-3994). When the last creative unlinks from a live
 * survey, nothing re-checks this: like deleting its last action, the survey then simply never shows.
 */

export const APP_SURVEY_TRIGGER_REQUIRED_MESSAGE =
  "An app survey must have at least one trigger, or a creative that opens it, to be set to a non-draft status.";

export const isAppSurveyMissingTriggersToPublish = ({
  type,
  status,
  triggers,
  isOpenedByCreative,
}: {
  type: TSurveyType;
  /** The status the survey is heading for, not the one it has. */
  status: TSurveyStatus;
  /** Falsy entries are holes the editor leaves when a trigger is removed. */
  triggers: readonly unknown[] | null | undefined;
  /** Whether any non-archived creative opens the survey. */
  isOpenedByCreative: boolean;
}): boolean =>
  type === "app" &&
  status !== "draft" &&
  !isOpenedByCreative &&
  (triggers ?? []).filter(Boolean).length === 0;
