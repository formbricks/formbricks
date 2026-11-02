"use client";

import { useTranslation } from "react-i18next";
import type { CreativeWarningZodType } from "@formbricks/api-v3-schemas";

/**
 * A creative's `warnings[]` entry in the dashboard's words, for the list row and the editor. The API may
 * add warning codes; an unknown one shows the API's own message.
 */
export const useCreativeWarningText = (): ((warning: CreativeWarningZodType) => string) => {
  const { t } = useTranslation();
  const messages: Partial<Record<string, string>> = {
    destinationMissing: t("workspace.creatives.warning_destination_missing"),
    destinationNotAllowed: t("workspace.creatives.warning_destination_not_allowed"),
    actionMissing: t("workspace.creatives.warning_action_missing"),
  };
  return (warning) => messages[warning.code] ?? warning.message;
};
