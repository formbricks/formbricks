import "server-only";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { env } from "@/lib/env";
import { isNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";

/** Readiness and entitlement control mutations only. Stored visibility is always enforced. */
export type TSurveyVisibilityGates = Readonly<{ entitled: boolean; ready: boolean }>;

export const getSurveyVisibilityGates = async (organizationId: string): Promise<TSurveyVisibilityGates> => {
  const ready =
    env.SURVEY_VISIBILITY_FORCE_DISABLED !== "1" &&
    (await isNewReleaseWorkEnabled()) &&
    (await isSurveyVisibilityReady());
  return { entitled: ready && (await getAccessControlPermission(organizationId)), ready };
};
