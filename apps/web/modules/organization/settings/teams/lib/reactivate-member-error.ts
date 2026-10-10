import type { TFunction } from "i18next";
import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * What to tell an owner or manager when reactivating a member fails, in their language. The server's
 * `detail` is English, so only the problem `code` is read; anything without a message of its own (a
 * timeout, a network failure, a refusal) gets the generic failure, never the raw error text.
 */
export const getReactivateMemberErrorMessage = (error: unknown, t: TFunction): string => {
  if (error instanceof V3ApiError) {
    switch (error.code) {
      case "member_in_other_organizations":
        return t("workspace.settings.data_retention.reactivate_member_in_other_organizations");
      case "too_many_requests":
        return t("common.error_rate_limit_description");
    }
  }
  return t("workspace.settings.data_retention.reactivate_failed");
};
