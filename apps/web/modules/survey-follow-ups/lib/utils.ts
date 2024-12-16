import { IS_FORMBRICKS_CLOUD, PROJECT_FEATURE_KEYS } from "@formbricks/lib/constants";
import { TOrganization } from "@formbricks/types/organizations";

export const getSurveyFollowUpsPermission = async (organization: TOrganization): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.plan !== PROJECT_FEATURE_KEYS.FREE;
  return true;
};
