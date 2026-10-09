import type { TFunction } from "i18next";
import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * What to tell the user when a data retention request fails, in their language. The server's `detail`
 * is English, so only the problem `code` is read: data retention's own codes and a rate limit get a
 * message of their own, and anything else (another status, a timeout, a network failure) gets
 * `fallback`. The raw error text is never shown.
 */
export const getRetentionErrorMessage = (error: unknown, t: TFunction, fallback: string): string => {
  if (!(error instanceof V3ApiError)) return fallback;
  switch (error.code) {
    case "retention_exemption_exists":
      return t("workspace.settings.data_retention.exemption_exists");
    case "retention_exemption_not_active":
      return t("workspace.settings.data_retention.exemption_not_active");
    case "retention_export_too_large":
      return t("workspace.settings.data_retention.export_too_large");
    case "too_many_requests":
      return t("common.error_rate_limit_description");
    default:
      return fallback;
  }
};

/**
 * A failed policy save. The policies route answers a policy that breaks a business rule (a period or
 * notice out of range, a notice as long as the period, no condition) with a 422 whose field issues are
 * English prose, so it is reported as one translated "not valid" message.
 */
export const getRetentionPolicySaveErrorMessage = (error: unknown, t: TFunction): string =>
  error instanceof V3ApiError && error.code === "unprocessable_content"
    ? t("workspace.settings.data_retention.policy_invalid")
    : getRetentionErrorMessage(error, t, t("workspace.settings.data_retention.policy_save_failed"));
