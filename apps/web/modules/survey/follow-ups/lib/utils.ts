import { IS_FORMBRICKS_CLOUD, PROJECT_FEATURE_KEYS } from "@/lib/constants";
import { Organization } from "@prisma/client";

export const getSurveyFollowUpsPermission = async (
  billingPlan: Organization["billing"]["plan"]
): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return billingPlan !== PROJECT_FEATURE_KEYS.FREE;
  return true;
};
