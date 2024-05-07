import "server-only";

import { cache, revalidateTag } from "@formbricks/lib/cache";
import { E2E_TESTING, ENTERPRISE_LICENSE_KEY, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { hashString } from "@formbricks/lib/hashString";
import { TTeam } from "@formbricks/types/teams";

import { prisma } from "../../database/src";

const PREVIOUS_RESULTS_CACHE_TAG = "getPreviousResult";

// This function is used to get the previous result of the license check from the cache
// This might seem confusing at first since we only return the default value from this function,
// but since we are using a cache and the cache key is the same, the cache will return the previous result - so this functions as a cache getter
const getPreviousResult = (): Promise<{ active: boolean | null; lastChecked: Date }> =>
  cache(
    async () => ({
      active: null,
      lastChecked: new Date(0),
    }),
    [PREVIOUS_RESULTS_CACHE_TAG],
    {
      tags: [PREVIOUS_RESULTS_CACHE_TAG],
    }
  )();

// This function is used to set the previous result of the license check to the cache so that we can use it in the next call
// Uses the same cache key as the getPreviousResult function
const setPreviousResult = async (previousResult: { active: boolean | null; lastChecked: Date }) => {
  revalidateTag(PREVIOUS_RESULTS_CACHE_TAG);
  const { lastChecked, active } = previousResult;

  await cache(
    async () => ({
      active,
      lastChecked,
    }),
    [PREVIOUS_RESULTS_CACHE_TAG],
    {
      tags: [PREVIOUS_RESULTS_CACHE_TAG],
    }
  )();
};

export const getIsEnterpriseEdition = async (): Promise<boolean> => {
  if (!ENTERPRISE_LICENSE_KEY || ENTERPRISE_LICENSE_KEY.length === 0) {
    return false;
  }

  const hashedKey = hashString(ENTERPRISE_LICENSE_KEY);

  if (E2E_TESTING) {
    const previousResult = await getPreviousResult();
    if (previousResult.lastChecked.getTime() === new Date(0).getTime()) {
      // first call
      await setPreviousResult({ active: true, lastChecked: new Date() });
      return true;
    } else if (new Date().getTime() - previousResult.lastChecked.getTime() > 24 * 60 * 60 * 1000) {
      // Fail after 24 hours
      console.log("E2E_TESTING is enabled. Enterprise license was revoked after 24 hours.");
      return false;
    }

    return previousResult.active !== null ? previousResult.active : false;
  }

  // if the server responds with a boolean, we return it
  // if the server errors, we return null
  // null signifies an error
  const isValid: boolean | null = await cache(
    async () => {
      try {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1); // January 1st of the current year
        const endOfYear = new Date(now.getFullYear() + 1, 0, 0); // December 31st of the current year

        const responseCount = await prisma.response.count({
          where: {
            createdAt: {
              gte: startOfYear,
              lt: endOfYear,
            },
          },
        });

        const res = await fetch("https://ee.formbricks.com/api/licenses/check", {
          body: JSON.stringify({
            licenseKey: ENTERPRISE_LICENSE_KEY,
            usage: { responseCount: responseCount },
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (res.ok) {
          const responseJson = await res.json();
          return responseJson.data.status === "active";
        }

        return null;
      } catch (error) {
        console.error("Error while checking license: ", error);
        return null;
      }
    },
    [`getIsEnterpriseEdition-${hashedKey}`],
    { revalidate: 60 * 60 * 24 }
  )();

  const previousResult = await getPreviousResult();

  if (previousResult.active === null) {
    if (isValid === null) {
      await setPreviousResult({ active: false, lastChecked: new Date() });
      return false;
    }
  }

  if (isValid !== null) {
    await setPreviousResult({ active: isValid, lastChecked: new Date() });
    return isValid;
  } else {
    // if result is undefined -> error
    // if the last check was less than 24 hours, return the previous value:
    if (new Date().getTime() - previousResult.lastChecked.getTime() <= 24 * 60 * 60 * 1000) {
      return previousResult.active !== null ? previousResult.active : false;
    }

    // if the last check was more than 24 hours, throw an error
    throw new Error("Error while checking license");
  }
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
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition();
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
