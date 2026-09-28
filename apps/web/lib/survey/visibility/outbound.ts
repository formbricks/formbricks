import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getEffectiveVisibility } from "./policy";

/**
 * Outbound plumbing (ENG-3283): webhooks, integrations, feedback sources, follow-ups and workflows
 * send a survey's responses to someone outside its access list, so they only ever serve a survey that
 * is workspace-visible *now*. A pending change counts as private either way (fail closed).
 *
 * Enforced twice: when a connection is attached (a clear error for the caller) and when a response is
 * dispatched (the attach check cannot see a survey made private later). Both are no-ops while survey
 * visibility is not enforced, so a deployment that has not opted in behaves exactly as before.
 */

export const SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE =
  "Outbound connections can only use surveys that are visible to the whole workspace";

/** The rows an outbound check needs: `visibilityPending` is the trigger-kept version mismatch. */
const notWorkspaceVisibleWhere: Prisma.SurveyWhereInput = {
  OR: [{ visibility: "private" }, { visibilityPending: true }],
};

/** Of `surveyIds`, the ones outbound plumbing must not serve. `[]` while enforcement is off. */
export const findNotWorkspaceVisibleSurveyIds = async (
  surveyIds: ReadonlyArray<string>
): Promise<string[]> => {
  const unique = [...new Set(surveyIds)];
  if (unique.length === 0 || !(await isSurveyVisibilityReady())) return [];

  const rows = await prisma.survey.findMany({
    where: { id: { in: unique }, ...notWorkspaceVisibleWhere },
    select: { id: true },
  });
  return rows.map(({ id }) => id);
};

/**
 * Of `next`, the surveys newly attached and not workspace-visible. Only additions are refused: a survey
 * made private after it was attached stays on the connection (dispatch skips it), so saving an
 * unrelated edit to that connection must not fail.
 */
export const findNewlyAttachedNotWorkspaceVisibleSurveyIds = (
  next: ReadonlyArray<string>,
  previous: ReadonlyArray<string>
): Promise<string[]> => {
  const existing = new Set(previous);
  return findNotWorkspaceVisibleSurveyIds(next.filter((surveyId) => !existing.has(surveyId)));
};

/** Server-action form of the attach-time guard: the app's generic "not allowed" error, with our copy. */
export const assertNewlyAttachedSurveysWorkspaceVisible = async (
  next: ReadonlyArray<string>,
  previous: ReadonlyArray<string> = []
): Promise<void> => {
  const blocked = await findNewlyAttachedNotWorkspaceVisibleSurveyIds(next, previous);
  if (blocked.length > 0) throw new OperationNotAllowedError(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE);
};

type TOutboundVisibilityRow = Parameters<typeof getEffectiveVisibility>[0];

/** Dispatch-time guard over a row already loaded, so the hot path pays no extra query. */
export const isSurveyOutboundAllowed = (row: TOutboundVisibilityRow, enforced: boolean): boolean =>
  !enforced || getEffectiveVisibility(row) === "workspace";

/** The columns {@link isSurveyOutboundAllowed} reads, for callers' `select`. */
export const surveyOutboundVisibilitySelect = {
  visibility: true,
  visibilityProjectedVersion: true,
  visibilityVersion: true,
} as const;
