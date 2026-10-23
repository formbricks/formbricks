import "server-only";
import { logger } from "@formbricks/logger";
import { can } from "@/lib/authorization";
import { recordSurveyListPredicateMismatch } from "@/lib/authorization/metrics";
import { filterReadableSurveyIds, lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { isAwaitingProjection } from "@/lib/survey/visibility/policy";
import type { TRetentionExemptionReadScope, TRetentionExemptionRow } from "./exemptions-service";

/**
 * Which exemptions a signed-in user may read in an organisation they already passed
 * `organization.read_access` for. Owners and managers read every survey, so all of them; anyone else
 * only those whose survey they could open (see `TRetentionExemptionReadScope`).
 *
 * The actor context is built here rather than through `resolveSurveyActorContext`, which would check
 * `organization.manage` a second time: its request cache does not apply in a route handler.
 */
export async function resolveRetentionExemptionReadScope(
  userId: string,
  organizationId: string
): Promise<TRetentionExemptionReadScope> {
  const actor = { type: "user", id: userId } as const;
  const [isOrganizationAdmin, enforced] = await Promise.all([
    can(actor, "organization.manage", { type: "organization", id: organizationId }),
    isSurveyVisibilityReady(),
  ]);
  if (isOrganizationAdmin) return { kind: "organization" };

  return {
    kind: "surveys",
    workspaceIds: await lookupAuthorizedWorkspaceIds(actor),
    actorContext: { enforced, isOrganizationAdmin: false, kind: "user", userId },
  };
}

/**
 * ENG-3282 defence in depth, as the v3 survey list does it: the SQL predicate already scoped the rows a
 * member reads, and the graph confirms their surveys in one bulk check. A row it denies is dropped and
 * counted, since a disagreement between PostgreSQL and SpiceDB is a projection bug and failing closed is
 * the safe direction. A survey whose projection is still in flight is decided by the predicate alone.
 */
export async function confirmReadableRetentionExemptions<TRow extends TRetentionExemptionRow>(
  userId: string,
  scope: TRetentionExemptionReadScope,
  rows: TRow[]
): Promise<TRow[]> {
  if (scope.kind === "organization" || !scope.actorContext.enforced || rows.length === 0) return rows;

  const settledSurveyIds = [
    ...new Set(rows.filter((row) => !isAwaitingProjection(row)).map((row) => row.surveyId)),
  ];
  const readable = await filterReadableSurveyIds({ type: "user", id: userId }, settledSurveyIds);
  const denied = new Set(settledSurveyIds.filter((surveyId) => !readable.has(surveyId)));
  if (denied.size === 0) return rows;

  recordSurveyListPredicateMismatch(denied.size);
  logger.warn(
    { deniedSurveyIds: [...denied] },
    "Retention exemptions predicate admitted surveys the graph denies"
  );
  return rows.filter((row) => !denied.has(row.surveyId));
}
