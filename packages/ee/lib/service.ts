import "server-only";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import { prisma } from "@formbricks/database";
import { cache, revalidateTag } from "@formbricks/lib/cache";
import {
  E2E_TESTING,
  ENTERPRISE_LICENSE_KEY,
  IS_FORMBRICKS_CLOUD,
  PRODUCT_FEATURE_KEYS,
} from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { hashString } from "@formbricks/lib/hashString";
import { TOrganization } from "@formbricks/types/organizations";
import { TEnterpriseLicenseDetails, TEnterpriseLicenseFeatures } from "./types";

const hashedKey = ENTERPRISE_LICENSE_KEY ? hashString(ENTERPRISE_LICENSE_KEY) : undefined;
const PREVIOUS_RESULTS_CACHE_TAG_KEY = `getPreviousResult-${hashedKey}` as const;

// This function is used to get the previous result of the license check from the cache
// This might seem confusing at first since we only return the default value from this function,
// but since we are using a cache and the cache key is the same, the cache will return the previous result - so this function acts as a cache getter
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

const fetchLicenseForE2ETesting = async (): Promise<{
  active: boolean | null;
  lastChecked: Date;
  features: TEnterpriseLicenseFeatures | null;
} | null> => {
  const currentTime = new Date();
  try {
    const previousResult = await getPreviousResult();
    if (previousResult.lastChecked.getTime() === new Date(0).getTime()) {
      // first call
      const newResult = {
        active: true,
        features: { isMultiOrgEnabled: true },
        lastChecked: currentTime,
      };
      await setPreviousResult(newResult);
      return newResult;
    } else if (currentTime.getTime() - previousResult.lastChecked.getTime() > 60 * 60 * 1000) {
      // Fail after 1 hour
      console.log("E2E_TESTING is enabled. Enterprise license was revoked after 1 hour.");
      return null;
    }
    return previousResult;
  } catch (error) {
    console.error("Error fetching license: ", error);
    return null;
  }
};

export const getEnterpriseLicense = async (): Promise<{
  active: boolean;
  features: TEnterpriseLicenseFeatures | null;
  lastChecked: Date;
  isPendingDowngrade?: boolean;
}> => {
  if (!ENTERPRISE_LICENSE_KEY || ENTERPRISE_LICENSE_KEY.length === 0) {
    return {
      active: false,
      features: null,
      lastChecked: new Date(),
    };
  }

  if (E2E_TESTING) {
    const previousResult = await fetchLicenseForE2ETesting();

    return {
      active: previousResult?.active ?? false,
      features: previousResult ? previousResult.features : null,
      lastChecked: previousResult ? previousResult.lastChecked : new Date(),
    };
  }

  // if the server responds with a boolean, we return it
  // if the server errors, we return null
  // null signifies an error
  const license = await fetchLicense();

  const isValid = license ? license.status === "active" : null;
  const threeDaysInMillis = 3 * 24 * 60 * 60 * 1000;
  const currentTime = new Date();

  const previousResult = await getPreviousResult();

  // Case: First time checking license and the server errors out
  if (previousResult.active === null) {
    if (isValid === null) {
      const newResult = {
        active: false,
        features: { isMultiOrgEnabled: false },
        lastChecked: new Date(),
      };

      await setPreviousResult(newResult);
      return newResult;
    }
  }

  if (isValid !== null && license) {
    const newResult = {
      active: isValid,
      features: license.features,
      lastChecked: new Date(),
    };

    await setPreviousResult(newResult);
    return newResult;
  } else {
    // if result is undefined -> error
    // if the last check was less than 72 hours, return the previous value:

    const elapsedTime = currentTime.getTime() - previousResult.lastChecked.getTime();
    if (elapsedTime < threeDaysInMillis) {
      return {
        active: previousResult.active !== null ? previousResult.active : false,
        features: previousResult.features,
        lastChecked: previousResult.lastChecked,
        isPendingDowngrade: true,
      };
    }

    // Log error only after 72 hours
    console.error("Error while checking license: The license check failed");

    return {
      active: false,
      features: null,
      lastChecked: previousResult.lastChecked,
      isPendingDowngrade: true,
    };
  }
};

export const getLicenseFeatures = async (): Promise<TEnterpriseLicenseFeatures | null> => {
  const previousResult = await getPreviousResult();
  if (previousResult.features) {
    return previousResult.features;
  } else {
    const license = await fetchLicense();
    if (!license || !license.features) return null;
    return license.features;
  }
};

export const fetchLicense = async (): Promise<TEnterpriseLicenseDetails | null> =>
  await cache(
    async () => {
      if (!env.ENTERPRISE_LICENSE_KEY) return null;
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

        const proxyUrl = env.HTTPS_PROXY || env.HTTP_PROXY;
        const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

        const res = await fetch("https://ee.formbricks.com/api/licenses/check", {
          body: JSON.stringify({
            licenseKey: ENTERPRISE_LICENSE_KEY,
            usage: { responseCount: responseCount },
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          agent,
        });

        if (res.ok) {
          const responseJson = (await res.json()) as {
            data: TEnterpriseLicenseDetails;
          };
          return responseJson.data;
        }

        return null;
      } catch (error) {
        console.error("Error while checking license: ", error);
        return null;
      }
    },
    [`fetchLicense-${hashedKey}`],
    { revalidate: 60 * 60 * 24 }
  )();

export const getRemoveInAppBrandingPermission = (organization: TOrganization): boolean => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.plan !== PRODUCT_FEATURE_KEYS.FREE;
  else if (!IS_FORMBRICKS_CLOUD) return true;
  return false;
};

export const getRemoveLinkBrandingPermission = (organization: TOrganization): boolean => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.plan !== PRODUCT_FEATURE_KEYS.FREE;
  else if (!IS_FORMBRICKS_CLOUD) return true;
  return false;
};

export const getRoleManagementPermission = async (organization: TOrganization): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD)
    return (
      organization.billing.plan === PRODUCT_FEATURE_KEYS.SCALE ||
      organization.billing.plan === PRODUCT_FEATURE_KEYS.ENTERPRISE
    );
  else if (!IS_FORMBRICKS_CLOUD) return (await getEnterpriseLicense()).active;
  return false;
};

export const getAdvancedTargetingPermission = async (organization: TOrganization): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD)
    return (
      organization.billing.plan === PRODUCT_FEATURE_KEYS.SCALE ||
      organization.billing.plan === PRODUCT_FEATURE_KEYS.ENTERPRISE
    );
  else if (!IS_FORMBRICKS_CLOUD) return (await getEnterpriseLicense()).active;
  else return false;
};

export const getBiggerUploadFileSizePermission = async (organization: TOrganization): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) return organization.billing.plan !== PRODUCT_FEATURE_KEYS.FREE;
  else if (!IS_FORMBRICKS_CLOUD) return (await getEnterpriseLicense()).active;
  return false;
};

export const getMultiLanguagePermission = async (organization: TOrganization): Promise<boolean> => {
  if (E2E_TESTING) {
    const previousResult = await fetchLicenseForE2ETesting();
    return previousResult && previousResult.active !== null ? previousResult.active : false;
  }
  if (IS_FORMBRICKS_CLOUD)
    return (
      organization.billing.plan === PRODUCT_FEATURE_KEYS.SCALE ||
      organization.billing.plan === PRODUCT_FEATURE_KEYS.ENTERPRISE
    );
  else if (!IS_FORMBRICKS_CLOUD) return (await getEnterpriseLicense()).active;
  return false;
};

export const getIsMultiOrgEnabled = async (): Promise<boolean> => {
  if (E2E_TESTING) {
    const previousResult = await fetchLicenseForE2ETesting();
    return previousResult && previousResult.features ? previousResult.features.isMultiOrgEnabled : false;
  }
  const licenseFeatures = await getLicenseFeatures();
  if (!licenseFeatures) return false;
  return licenseFeatures.isMultiOrgEnabled;
};
