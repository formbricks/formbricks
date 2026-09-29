// Client-safe on purpose: the lite-license tips render inside client components (the workspace limit
// modal, the survey editor), so this module must not pull in `@/lib/constants` or anything server-only.
export const ENTERPRISE_LICENSE_REQUEST_FORM_URL =
  "https://app.formbricks.com/s/trvp8tzy5uvsps9rc9qi9l9w?delivery=onpremise&source=ce&type=licenseRequest";

// Which in-app touchpoint sent the request. It lands on the request form as a URL param, which is how
// requests are attributed on-prem, where product analytics are not available.
export type TLiteLicenseFeature = "enterprise_settings" | "two_factor_auth" | "workspaces";

export const getLiteLicenseRequestUrl = (feature: TLiteLicenseFeature): string => {
  const url = new URL(ENTERPRISE_LICENSE_REQUEST_FORM_URL);
  url.searchParams.set("type", "lite");
  url.searchParams.set("feature", feature);
  return url.toString();
};
