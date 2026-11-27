import type { TLicenseStatus } from "@/modules/ee/license-check/types/enterprise-license";

// `satisfies` makes a new license status fail to compile until it is classified here.
const CLOUD_LICENSE_STATUS_POLICY = {
  active: "usable",
  "no-license": "usable",
  unreachable: "usable-in-grace",
  expired: "refused",
  invalid_license: "refused",
  instance_mismatch: "refused",
} as const satisfies Record<TLicenseStatus, "usable" | "usable-in-grace" | "refused">;

/**
 * Whether Cloud may honour an organization's paid entitlements and limits under the instance license.
 * Every Cloud gate that reads the license goes through this, so they cannot disagree.
 *
 * Cloud refuses what the license server refuses: an `expired`, `invalid_license` or `instance_mismatch`
 * answer, or no verified license at all, falls back to the free tier (see `CLOUD_HOBBY_WORKSPACE_LIMIT`).
 * An `unreachable` check is different: the server gave no answer, and a single failed refresh is cached
 * for minutes and shared by every pod, so reading it as a refusal took paid features away from every
 * Cloud organization for that long (ENG-7563). While the license is still in its grace period it stays
 * `licenseActive` with the features it was last verified with, so Cloud keeps using those; once grace
 * ends the license resolves inactive and the free tier applies.
 */
export const isCloudLicenseUsable = ({
  licenseActive,
  licenseStatus,
}: {
  licenseActive: boolean;
  licenseStatus: TLicenseStatus;
}): boolean => {
  const policy = CLOUD_LICENSE_STATUS_POLICY[licenseStatus];
  if (policy === "usable") return true;
  if (policy === "usable-in-grace") return licenseActive;
  // "refused", and any status this table does not know, which fails closed.
  return false;
};
