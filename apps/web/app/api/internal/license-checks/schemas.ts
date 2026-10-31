import type { TLicenseStatus } from "@/modules/ee/license-check/types/enterprise-license";

/** What a recheck found: whether the license is active, and its status or why it isn't. */
export type TLicenseCheckResource = {
  active: boolean;
  status: TLicenseStatus | "invalid_license";
};
