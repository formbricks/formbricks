import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TSurveyListItemAccess } from "@/modules/survey/list/types/survey-overview";

/**
 * Client shapes of `GET` / `POST /api/v3/surveys/{surveyId}/visibility` (ENG-3282 contract §3), as
 * `app/api/v3/surveys/visibility/operations.ts` serializes them.
 */
type TSurveyVisibilityFields = {
  id: string;
  /** Enforced on this request. A change in flight is reported separately in `pending`. */
  visibility: TSurveyVisibility;
  owner: { name: string } | null;
  access: TSurveyListItemAccess;
  version: number;
  /** The value a stored change is still settling to, or `null` once enforced. */
  pending: TSurveyVisibility | null;
};

/** An outbound connection that makes `restricted` refusable. */
export type TSurveyVisibilityBlocker = {
  id: string;
  name: string;
  type: "dashboard" | "feedbackSource" | "integration" | "webhook" | "workflow";
};

export type TSurveyVisibilityState = TSurveyVisibilityFields & {
  blockers: TSurveyVisibilityBlocker[];
  impact: { memberCount: number; responseCount: number };
  /** The values a `POST` would accept right now. */
  allowedTargets: TSurveyVisibility[];
};

export type TSurveyVisibilityChangeResult = TSurveyVisibilityFields & {
  changedAt: string | null;
  changedBy: { id: string; name: string; type: "user" } | null;
};
