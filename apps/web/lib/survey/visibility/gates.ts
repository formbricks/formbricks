import "server-only";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";

/**
 * The two switches of the contract's gating table (README §5).
 *
 * - `ready`: the deployment's readiness marker. Decides *enforcement* — while it is off every survey is
 *   workspace-visible on every path, exactly as before ENG-3282.
 * - `entitled`: the organization's RBAC entitlement, meaningful only while `ready`. Decides whether
 *   anyone may *change* visibility and whether signed-in creation defaults to private. Losing it never
 *   releases a private survey (Decision 6).
 */
export type TSurveyVisibilityGates = Readonly<{ entitled: boolean; ready: boolean }>;

export const getSurveyVisibilityGates = async (organizationId: string): Promise<TSurveyVisibilityGates> => {
  const ready = await isSurveyVisibilityReady();
  return { entitled: ready && (await getAccessControlPermission(organizationId)), ready };
};
