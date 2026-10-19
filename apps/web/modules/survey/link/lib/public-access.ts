import type { TSurvey } from "@formbricks/types/surveys/types";

type TLinkSurveyAccessFields = Pick<TSurvey, "type" | "status" | "archivedAt">;

/**
 * Whether the public link page serves this survey at all. A draft, an archived survey or a survey of
 * another type does not exist for an anonymous visitor, so every public entry point (page, metadata,
 * actions) must answer "not found" for it (ENG-4032). Paused and completed surveys are served, but only
 * as their inactive screen.
 */
export const isLinkSurveyServable = <T extends TLinkSurveyAccessFields>(
  survey: T
): survey is T & { status: Exclude<TSurvey["status"], "draft"> } =>
  survey.type === "link" && survey.status !== "draft" && !survey.archivedAt;

/**
 * Whether a servable link survey is taking responses. That is the only state in which the page shows the
 * PIN or email-verification gate, so it is the only state in which their public actions may act on the
 * survey. A paused, scheduled or completed survey shows its inactive screen and never its definition.
 */
export const isLinkSurveyOpenForResponses = <T extends TLinkSurveyAccessFields>(
  survey: T
): survey is T & { status: "inProgress" } => isLinkSurveyServable(survey) && survey.status === "inProgress";
