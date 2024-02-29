import { ENTERPRISE_LICENSE_KEY, IS_FORMBRICKS_CLOUD } from "../constants";
import { getTeam } from "../team/service";

export const getIsEnterpriseEdition = (): boolean => {
  if (ENTERPRISE_LICENSE_KEY) {
    return ENTERPRISE_LICENSE_KEY.length > 0;
  }
  return false;
};

export const getMultiLanguagePermission = async (teamId: string): Promise<boolean> => {
  const team = await getTeam(teamId);
  if (!team) return false;
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return getIsEnterpriseEdition();
  else return false;
};
