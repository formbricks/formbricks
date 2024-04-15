import "server-only";

import { unstable_cache } from "next/cache";

import { ENTERPRISE_LICENSE_KEY, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { hashString } from "@formbricks/lib/hashString";
import { TTeam } from "@formbricks/types/teams";

export const getIsEnterpriseEdition = async (): Promise<boolean> => {
  if (!ENTERPRISE_LICENSE_KEY || ENTERPRISE_LICENSE_KEY.length === 0) {
    return false;
  }

  const hashedKey = hashString(ENTERPRISE_LICENSE_KEY);

  const isValid = await unstable_cache(
    async () => {
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

        return isValid;
      } catch (error) {
        console.error("Error while checking license", error);
        return false;
      }
    },
    [`getIsEnterpriseEdition-${hashedKey}`],
    { revalidate: 60 * 60 * 24 }
  )();

  return isValid;
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
