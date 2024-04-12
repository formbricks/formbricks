import "server-only";

import { ENTERPRISE_LICENSE_KEY, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TTeam } from "@formbricks/types/teams";

const licenseDetails: {
  isValid: boolean | null;
  lastChecked: Date;
} = {
  isValid: null,
  lastChecked: new Date(0), // Initialize with an old date
};

export const getIsEnterpriseEdition = async (): Promise<boolean> => {
  if (ENTERPRISE_LICENSE_KEY && ENTERPRISE_LICENSE_KEY.length > 0) {
    const currentTime = new Date();
    const timeSinceLastChecked = currentTime.getTime() - licenseDetails.lastChecked.getTime(); // Difference in milliseconds

    // Check if the lastChecked time is within the last 24 hours
    if (
      licenseDetails.isValid !== null &&
      timeSinceLastChecked < 1000 * 60 * 60 * 24 // 1000ms * 60s * 60min * 24hrs
    ) {
      return licenseDetails.isValid;
    }

    try {
      const res = await fetch("https://ee.formbricks.com/api/licenses/check", {
        body: JSON.stringify({ licenseKey: ENTERPRISE_LICENSE_KEY }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      let isValid = false;

      if (res.ok) {
        const responseJson = await res.json();
        isValid = responseJson.data.status === "active";
      }

      licenseDetails.isValid = isValid;
      licenseDetails.lastChecked = new Date(); // Update the last checked time

      return isValid;
    } catch (error) {
      console.error("Error while checking license", error);
    }
  }
  return false;
};

export const getRemoveInAppBrandingPermission = (team: TTeam): boolean => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return true;
  else return false;
};

export const getRemoveLinkBrandingPermission = (team: TTeam): boolean => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.linkSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return true;
  else return false;
};

export const getRoleManagementPermission = async (team: TTeam): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return getIsEnterpriseEdition();
  else return false;
};

export const getAdvancedTargetingPermission = async (team: TTeam): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.userTargeting.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition();
  else return false;
};

export const getMultiLanguagePermission = async (team: TTeam): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition();
  else return false;
};
