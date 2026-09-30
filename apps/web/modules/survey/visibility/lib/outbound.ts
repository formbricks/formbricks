import type { TSurveyVisibility } from "@formbricks/types/surveys/types";

/**
 * Client side of the outbound rule (ENG-3283, `lib/survey/visibility/outbound.ts`): webhooks,
 * integrations, feedback sources, follow-ups and workflows only serve workspace-visible surveys. The
 * server refuses to attach a restricted survey and skips one at dispatch; these helpers let the UI
 * say so up front instead. They take `enforced` (`TSurveyVisibilityUiGate.enforced`): the server
 * keeps refusing restricted surveys while visibility is enforced, whether or not the organization is
 * still entitled to change it. Every one of them is false while it is not, so the UI stays as it was.
 */

/** A survey as the pickers hold it. `visibility` is optional: some lists only carry it with the gate on. */
export type TOutboundSurvey = Readonly<{ id: string; visibility?: TSurveyVisibility | null }>;

const isRestricted = (survey: TOutboundSurvey | undefined): boolean => survey?.visibility === "restricted";

/**
 * Whether a picker must refuse this survey. Only a new attachment is refused: one already on the
 * connection stays selectable so it can be removed, and the server accepts it unchanged.
 */
export const isRestrictedSurveyPick = (
  enforced: boolean,
  survey: TOutboundSurvey,
  attachedSurveyIds: ReadonlyArray<string> = []
): boolean => enforced && isRestricted(survey) && !attachedSurveyIds.includes(survey.id);

/** Whether a connection serves at least one restricted survey, which dispatch then skips. */
export const hasRestrictedAttachedSurvey = (
  enforced: boolean,
  attachedSurveyIds: ReadonlyArray<string>,
  surveys: ReadonlyArray<TOutboundSurvey>
): boolean => {
  if (!enforced || attachedSurveyIds.length === 0) return false;
  const attached = new Set(attachedSurveyIds);
  return surveys.some((survey) => attached.has(survey.id) && isRestricted(survey));
};

/**
 * The server's attach-time refusal, as `lib/survey/visibility/outbound.ts` words it. Kept in step by
 * `outbound.test.ts`; the server module is `server-only`, so it cannot be imported here.
 */
export const SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE =
  "Outbound connections can only use surveys that are visible to the whole workspace";

/** Whether an error message is that refusal, so the caller can show readable copy instead. */
export const isSurveyNotWorkspaceVisibleMessage = (message: string | null | undefined): boolean =>
  !!message?.includes(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE);
