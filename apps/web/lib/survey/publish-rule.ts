import type { TSurveyStatus, TSurveyType } from "@formbricks/types/surveys/types";

/**
 * The publish rule for app surveys, in one copy that every writer shares: the server's create and update,
 * the v3 PATCH and the survey editor's own check (client-safe on purpose, so the editor never promises a
 * save the API then refuses).
 *
 * A live (non-draft) app survey needs something that can show it: a trigger of its own, or a
 * non-archived creative that opens it (ENG-3914, ENG-3994). When the last creative stops opening a live
 * survey, the change still goes through and the survey then never shows, like deleting its last action:
 * the dashboard confirms it first (`leavesSurveyUnopened` in `modules/ee/creatives/lib/survey-side.ts`), and
 * the API and MCP describe it on archive, delete and relink.
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
