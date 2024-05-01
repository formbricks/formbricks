import "server-only";

import { cache } from "@formbricks/lib/cache";
import { ENTERPRISE_LICENSE_KEY, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { hashString } from "@formbricks/lib/hashString";
import { TTeam } from "@formbricks/types/teams";

import { prisma } from "../../database/src";

export const getIsEnterpriseEdition = async (teamId: string): Promise<boolean> => {
  if (!ENTERPRISE_LICENSE_KEY || ENTERPRISE_LICENSE_KEY.length === 0) {
    return false;
  }

  const hashedKey = hashString(ENTERPRISE_LICENSE_KEY);

  const isValid = await cache(
    async () => {
      try {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1); // January 1st of the current year
        const endOfYear = new Date(now.getFullYear() + 1, 0, 0); // December 31st of the current year

        const responseCountForTeam = await prisma.response.count({
          where: {
            createdAt: {
              gte: startOfYear,
              lt: endOfYear,
            },
            survey: {
              environment: {
                product: {
                  teamId,
                },
              },
            },
          },
        });

        // const res = await fetch("https://ee.formbricks.com/api/licenses/check", {
        const res = await fetch("http://localhost:8080/api/licenses/check", {
          body: JSON.stringify({
            licenseKey: ENTERPRISE_LICENSE_KEY,
            usage: { responseCount: responseCountForTeam },
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (res.ok) {
          const responseJson = await res.json();
          return responseJson.data.status === "active";
        }

        return false;
      } catch (error) {
        console.error("Error while checking license: ", error);
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
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition(team.id);
  else return false;
};

export const getAdvancedTargetingPermission = async (team: TTeam): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.userTargeting.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition(team.id);
  else return false;
};

export const getMultiLanguagePermission = async (team: TTeam): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return team.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition(team.id);
  else return false;
};
