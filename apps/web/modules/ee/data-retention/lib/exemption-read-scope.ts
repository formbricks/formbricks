import "server-only";
import { can } from "@/lib/authorization";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import type { TRetentionExemptionReadScope } from "./exemptions-service";

/**
 * Which exemptions a signed-in user may read in an organisation they already passed
 * `organization.read_access` for. Owners and managers read every survey, so all of them; anyone else
 * only those whose survey they could open (see `TRetentionExemptionReadScope`).
 */
export async function resolveRetentionExemptionReadScope(
  userId: string,
  organizationId: string
): Promise<TRetentionExemptionReadScope> {
  const actor = { type: "user", id: userId } as const;
  if (await can(actor, "organization.manage", { type: "organization", id: organizationId })) {
    return { kind: "organization" };
  }

  const [workspaceIds, actorContext] = await Promise.all([
    lookupAuthorizedWorkspaceIds(actor),
    resolveSurveyActorContext(actor, organizationId),
  ]);
  return { kind: "surveys", workspaceIds, actorContext };
}
