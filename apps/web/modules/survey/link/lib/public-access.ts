import { ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TLinkSurvey } from "@/modules/survey/link/lib/data";

// From `TLinkSurvey`, so `archivedAt` is required: see there for why a loader must select it.
export type TLinkSurveyAccessFields = Pick<TLinkSurvey, "type" | "status" | "archivedAt">;

// What each guard proves, in full: narrowing only `status` would let a caller whose `status` is already
// narrowed collapse the false branch to `never` while the survey could still be an app or archived one.
type TServableLinkSurvey = {
  type: "link";
  status: Exclude<TSurvey["status"], "draft">;
  archivedAt: null;
};

/**
 * Whether the public link page serves this survey at all. A draft, an archived survey or a survey of
 * another type does not exist for an anonymous visitor (ENG-4032): `/s`, `/c` and `/p` 404 it, the `/s`
 * metadata 404s, the `/c` metadata stays generic, and the public actions answer "not found". Paused and
 * completed surveys are served, but only as their inactive screen.
 */
export const isLinkSurveyServable = <T extends TLinkSurveyAccessFields>(
  survey: T
): survey is T & TServableLinkSurvey =>
  survey.type === "link" && survey.status !== "draft" && !survey.archivedAt;

/**
 * Whether a servable link survey is taking responses. That is the only state in which the page shows the
 * PIN or email-verification gate, so it is the only state in which their public actions may act on the
 * survey. A paused, scheduled or completed survey shows its inactive screen and never its definition.
 */
export const isLinkSurveyOpenForResponses = <T extends TLinkSurveyAccessFields>(
  survey: T
): survey is T & TServableLinkSurvey & { status: "inProgress" } =>
  isLinkSurveyServable(survey) && survey.status === "inProgress";

/**
 * Whether a link-survey action's `serverError` is its "not found" answer for this survey: the survey stopped
 * taking responses (closed, archived or gone) after the page loaded, so the page should be re-rendered rather
 * than shown as a failed attempt. Matched against the error the server builds, not a hand-written string.
 */
export const isLinkSurveyGoneError = (serverError: string | undefined, surveyId: string): boolean =>
  serverError === new ResourceNotFoundError("Survey", surveyId).message;
