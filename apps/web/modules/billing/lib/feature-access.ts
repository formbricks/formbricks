import "server-only";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getOrganizationBillingWithReadThroughSync } from "./organization-billing";

export const hasCloudEntitlement = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) return false;

  const billing = await getOrganizationBillingWithReadThroughSync(organizationId);
  const features = billing?.stripe?.features ?? [];

  return features.includes(featureLookupKey);
};

export const hasCloudEntitlementWithLicenseGuard = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) return false;

  const license = await getEnterpriseLicense();
  if (!license.active) return false;

  return hasCloudEntitlement(organizationId, featureLookupKey);
};
