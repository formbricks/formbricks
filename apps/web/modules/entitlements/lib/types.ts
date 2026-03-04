import type {
  TEnterpriseLicenseFeatures,
  TEnterpriseLicenseStatusReturn,
} from "@/modules/ee/license-check/types/enterprise-license";

export type TEntitlementSource = "cloud_stripe" | "self_hosted_license";

export type TEntitlementLimits = {
  projects: number | null;
  monthlyResponses: number | null;
  monthlyMiu: number | null;
};

export type TOrganizationEntitlementsContext = {
  organizationId: string;
  source: TEntitlementSource;
  features: string[];
  limits: TEntitlementLimits;
  licenseStatus: TEnterpriseLicenseStatusReturn;
  licenseFeatures: TEnterpriseLicenseFeatures | null;
  stripeCustomerId: string | null;
  periodStart: Date | null;
};
