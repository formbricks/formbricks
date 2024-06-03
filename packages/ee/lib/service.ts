import "server-only";

import { cache, revalidateTag } from "@formbricks/lib/cache";
import { E2E_TESTING, ENTERPRISE_LICENSE_KEY, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { hashString } from "@formbricks/lib/hashString";
import { TOrganization } from "@formbricks/types/organizations";

import { prisma } from "../../database/src";
import { TEnterpriseLicenseDetails, TEnterpriseLicenseFeatures } from "./types";

const hashedKey = ENTERPRISE_LICENSE_KEY ? hashString(ENTERPRISE_LICENSE_KEY) : undefined;
const PREVIOUS_RESULTS_CACHE_TAG_KEY = `getPreviousResult-${hashedKey}` as const;

// This function is used to get the previous result of the license check from the cache
// This might seem confusing at first since we only return the default value from this function,
// but since we are using a cache and the cache key is the same, the cache will return the previous result - so this functions as a cache getter
const getPreviousResult = (): Promise<{
  active: boolean | null;
  lastChecked: Date;
  features: TEnterpriseLicenseFeatures | null;
}> =>
  cache(
    async () => ({
      active: null,
      lastChecked: new Date(0),
      features: null,
    }),
    [PREVIOUS_RESULTS_CACHE_TAG_KEY],
    {
      tags: [PREVIOUS_RESULTS_CACHE_TAG_KEY],
    }
  )();

// This function is used to set the previous result of the license check to the cache so that we can use it in the next call
// Uses the same cache key as the getPreviousResult function
const setPreviousResult = async (previousResult: {
  active: boolean | null;
  lastChecked: Date;
  features: TEnterpriseLicenseFeatures | null;
}) => {
  revalidateTag(PREVIOUS_RESULTS_CACHE_TAG_KEY);
  const { lastChecked, active, features } = previousResult;

  await cache(
    async () => ({
      active,
      lastChecked,
      features,
    }),
    [PREVIOUS_RESULTS_CACHE_TAG_KEY],
    {
      tags: [PREVIOUS_RESULTS_CACHE_TAG_KEY],
    }
  )();
};

export const getIsEnterpriseEdition = async (): Promise<boolean> => {
  if (!ENTERPRISE_LICENSE_KEY || ENTERPRISE_LICENSE_KEY.length === 0) {
    return false;
  }

  if (E2E_TESTING) {
    const previousResult = await getPreviousResult();
    if (previousResult.lastChecked.getTime() === new Date(0).getTime()) {
      // first call
      await setPreviousResult({
        active: true,
        features: { isMultiOrgEnabled: true },
        lastChecked: new Date(),
      });
      return true;
    } else if (new Date().getTime() - previousResult.lastChecked.getTime() > 60 * 60 * 1000) {
      // Fail after 1 hour
      console.log("E2E_TESTING is enabled. Enterprise license was revoked after 1 hour.");
      return false;
    }

    return previousResult.active !== null ? previousResult.active : false;
  }

  // if the server responds with a boolean, we return it
  // if the server errors, we return null
  // null signifies an error
  const licenseDetails = await getLicenseDetails();
  const isValid = licenseDetails ? licenseDetails.status === "active" : null;

  const previousResult = await getPreviousResult();
  if (previousResult.active === null) {
    if (isValid === null) {
      await setPreviousResult({
        active: false,
        features: { isMultiOrgEnabled: false },
        lastChecked: new Date(),
      });
      return false;
    }
  }

  if (isValid !== null && licenseDetails) {
    await setPreviousResult({ active: isValid, features: licenseDetails.features, lastChecked: new Date() });
    return isValid;
  } else {
    // if result is undefined -> error
    // if the last check was less than 72 hours, return the previous value:
    if (new Date().getTime() - previousResult.lastChecked.getTime() <= 3 * 24 * 60 * 60 * 1000) {
      return previousResult.active !== null ? previousResult.active : false;
    }

    // if the last check was more than 72 hours, return false and log the error
    console.error("Error while checking license: The license check failed");
    return false;
  }
};

export const getLicenseFeatures = async (): Promise<TEnterpriseLicenseFeatures | null> => {
  const previousResult = await getPreviousResult();
  if (previousResult.features) {
    return previousResult.features;
  } else {
    const licenseDetails = await getLicenseDetails();
    if (!licenseDetails) return null;
    const features = await licenseDetails.features;
    return features;
  }
};

export const getLicenseDetails = async () => {
  const licenseResult: TEnterpriseLicenseDetails | null = await cache(
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
          return { status: responseJson.data.status, features: responseJson.data.features };
        }

        return null;
      } catch (error) {
        console.error("Error while checking license: ", error);
        return null;
      }
    },
    [`getLicenseDetails-${hashedKey}`],
    { revalidate: 60 * 60 * 24 }
  )();
  return licenseResult;
};

export const getRemoveInAppBrandingPermission = (organization: TOrganization): boolean => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return true;
  else return false;
};

export const getRemoveLinkBrandingPermission = (organization: TOrganization): boolean => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.features.linkSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return true;
  else return false;
};

export const getRoleManagementPermission = async (organization: TOrganization): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition();
  else return false;
};

export const getAdvancedTargetingPermission = async (organization: TOrganization): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.features.userTargeting.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition();
  else return false;
};

export const getMultiLanguagePermission = async (organization: TOrganization): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.features.inAppSurvey.status !== "inactive";
  else if (!IS_FORMBRICKS_CLOUD) return await getIsEnterpriseEdition();
  else return false;
};

export const getIsMultiOrgEnabled = async (): Promise<boolean> => {
  if (process.env.NODE_ENV === "development" || E2E_TESTING) return true;
  const licenseFeatures = await getLicenseFeatures();
  if (!licenseFeatures) return false;
  return licenseFeatures.isMultiOrgEnabled;
};
