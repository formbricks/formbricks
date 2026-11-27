import type { TLicenseStatus } from "@/modules/ee/license-check/types/enterprise-license";

/**
 * The license server's answers that refuse a license: it lapsed (`expired`), its key is unknown (HTTP 400,
 * `invalid_license`), or it is bound to another instance (HTTP 403, `instance_mismatch`). The one list both
 * the license client (which remembers a refusal) and the Cloud gates (which honour it) read.
 */
export const LICENSE_REFUSAL_STATUSES = [
  "expired",
  "invalid_license",
  "instance_mismatch",
] as const satisfies readonly TLicenseStatus[];

export type TLicenseRefusalStatus = (typeof LICENSE_REFUSAL_STATUSES)[number];

export const isLicenseRefusalStatus = (value: unknown): value is TLicenseRefusalStatus =>
  typeof value === "string" && (LICENSE_REFUSAL_STATUSES as readonly string[]).includes(value);
