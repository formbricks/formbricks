import "server-only";

import { ENTERPRISE_LICENSE_KEY, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TTeam } from "@formbricks/types/teams";

export const getIsEnterpriseEdition = (): boolean => {
  if (ENTERPRISE_LICENSE_KEY) {
    return ENTERPRISE_LICENSE_KEY.length > 0;
  }
  return false;
};

export const getRemoveInAppBrandingPermission = (team: TTeam): boolean => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return getIsEnterpriseEdition();
  else return false;
};

export const getRemoveLinkBrandingPermission = (team: TTeam): boolean => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.linkSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return true;
  else return false;
};

export const getRoleManagementPermission = (team: TTeam): boolean => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return getIsEnterpriseEdition();
  else return false;
};

export const getUserTargetingPermission = (team: TTeam): boolean => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.userTargeting.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return getIsEnterpriseEdition();
  else return false;
};
