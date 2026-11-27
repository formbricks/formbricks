import {
  type TLicenseRefusalStatus,
  isLicenseRefusalStatus,
} from "@/modules/ee/license-check/lib/license-status";
import type { TLicenseStatus } from "@/modules/ee/license-check/types/enterprise-license";

// Every status the license server does not refuse. `satisfies` makes a new one fail to compile until it
// is classified here; the refusals come from `LICENSE_REFUSAL_STATUSES` alone.
const CLOUD_LICENSE_POLICY = {
  active: "usable",
  "no-license": "usable",
  unreachable: "usable-in-grace",
} as const satisfies Record<Exclude<TLicenseStatus, TLicenseRefusalStatus>, "usable" | "usable-in-grace">;

/**
 * Whether Cloud may honour an organization's license-guarded entitlements and limits under the instance
 * license. Every Cloud gate that consults the license for them goes through this, so they cannot disagree.
 *
 * Cloud refuses what the license server refuses: an `expired`, `invalid_license` or `instance_mismatch`
 * answer, or no verified license at all, falls back to the free tier (see `CLOUD_HOBBY_WORKSPACE_LIMIT`).
 * An `unreachable` check is different: the server gave no answer, and a single failed refresh is cached
 * for minutes and shared by every pod, so reading it as a refusal took paid features away from every
 * Cloud organization for that long (ENG-7563). While the license is still in its grace period it stays
 * `licenseActive` with the features it was last verified with, so Cloud keeps using those; once grace
 * ends the license resolves inactive and the free tier applies. A refusal stays a refusal through a
 * later unreachable check: license.ts reports the recorded refusal instead of "unreachable".
 */
export const isCloudLicenseUsable = ({
  licenseActive,
  licenseStatus,
}: {
  licenseActive: boolean;
  licenseStatus: TLicenseStatus;
}): boolean => {
  if (isLicenseRefusalStatus(licenseStatus)) return false;
  // Widened so a status this table does not know reads as undefined and fails closed.
  const policy: string | undefined = CLOUD_LICENSE_POLICY[licenseStatus];
  if (policy === "usable") return true;
  if (policy === "usable-in-grace") return licenseActive;
  return false;
};
