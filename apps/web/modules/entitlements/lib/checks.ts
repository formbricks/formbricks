import "server-only";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { getOrganizationEntitlementsContext } from "./provider";
import { isEntitlementFeature } from "./types";

const LICENSE_GUARDED_ENTITLEMENTS: Partial<Record<string, keyof TEnterpriseLicenseFeatures>> = {
  "hide-branding": "removeBranding",
  "quota-management": "quotas",
  rbac: "accessControl",
  "spam-protection": "spamProtection",
  "multi-language-surveys": "multiLanguageSurveys",
};

export const hasOrganizationEntitlement = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  const context = await getOrganizationEntitlementsContext(organizationId);

  if (!isEntitlementFeature(featureLookupKey)) {
    return false;
  }

  return context.features.includes(featureLookupKey);
};

export const hasOrganizationEntitlementWithLicenseGuard = async (
  organizationId: string,
  featureLookupKey: string
): Promise<boolean> => {
  const context = await getOrganizationEntitlementsContext(organizationId);

  if (!isEntitlementFeature(featureLookupKey)) {
    return false;
  }

  if (!context.features.includes(featureLookupKey)) {
    return false;
  }

  if (context.licenseStatus === "no-license") {
    return true;
  }

  if (context.licenseStatus !== "active") {
    return false;
  }

  const mappedLicenseFeature = LICENSE_GUARDED_ENTITLEMENTS[featureLookupKey];
  if (!mappedLicenseFeature) {
    return true;
  }

  return !!context.licenseFeatures?.[mappedLicenseFeature];
};

export const getOrganizationEntitlementLimits = async (organizationId: string) => {
  const context = await getOrganizationEntitlementsContext(organizationId);
  return context.limits;
};
