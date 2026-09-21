import type { TFunction } from "i18next";
import { ArrowDownToLineIcon, CalculatorIcon } from "lucide-react";
import type { TEmbeddedDataSource } from "@formbricks/types/embedded-data";
import type { TReservedFieldPrivacy } from "@formbricks/types/embedded-data-resolver";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import type { TAutoCapturedAvailability } from "../lib/auto-captured-fields";

/**
 * How a field's enum columns read on screen.
 *
 * One file so the table, the form's options and the type-change confirmation all say the same words —
 * the confirmation asks "Change Plan tier from Text to Number?", which is only true if the badge the
 * author read a moment ago said "Text".
 *
 * Every `t()` call takes a literal key: the translation scanner resolves them statically, so a table
 * of key strings would read as unused keys and fail the i18n check.
 */

export const getSourceLabel = (source: TEmbeddedDataSource, t: TFunction): string => {
  switch (source) {
    case "ingested":
      return t("workspace.embedded_data.source_passed_in");
    case "computed":
      return t("workspace.embedded_data.source_calculated");
    // Reserved fields are the second card, which never renders a source badge; the branch exists
    // because `TEmbeddedDataSource` includes the value.
    case "reserved":
      return t("workspace.embedded_data.auto_captured");
  }
};

export const getSourceIcon = (source: TEmbeddedDataSource, className: string) =>
  source === "computed" ? (
    <CalculatorIcon className={className} aria-hidden="true" />
  ) : (
    <ArrowDownToLineIcon className={className} aria-hidden="true" />
  );

/**
 * What kind of value a field holds, in the words Attributes already uses for the same four kinds.
 * Re-exported rather than restated so the two surfaces cannot drift apart again (ENG-1860).
 */
export { getDataTypeLabel } from "@/modules/ui/components/data-type-badge/lib/data-types";

/** What the Anonymize responses toggle does to an auto-captured field. */
export const getPrivacyLabel = (privacy: TReservedFieldPrivacy, t: TFunction): string => {
  switch (privacy) {
    case "keep":
      return t("workspace.embedded_data.privacy_kept");
    case "drop":
      return t("workspace.embedded_data.privacy_not_stored");
    case "redactQuery":
      return t("workspace.embedded_data.privacy_query_removed");
  }
};

export const getAvailabilityLabel = (availability: TAutoCapturedAvailability, t: TFunction): string =>
  availability === "always" ? t("common.yes") : t("workspace.embedded_data.after_response_submitted");

/**
 * A survey's status, as the usage popover names it.
 *
 * A paused survey with a publish date reads as "Scheduled" elsewhere, but the usage payload carries
 * only the status, so this cannot tell the two apart and says "Paused" for both.
 */
export const getSurveyStatusLabel = (status: TSurveyStatus, t: TFunction): string => {
  switch (status) {
    case "inProgress":
      return t("common.in_progress");
    case "paused":
      return t("common.paused");
    case "completed":
      return t("common.completed");
    case "draft":
      return t("common.draft");
  }
};
