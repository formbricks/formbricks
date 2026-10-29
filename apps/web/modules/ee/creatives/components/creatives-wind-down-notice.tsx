"use client";

import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

/**
 * Why the Creatives list and summary are read-only in wind-down (ENG-6602): the licence doesn't include
 * Creatives, so they are hidden from sites; authors can still take them down, and the rest show again by
 * themselves once the licence includes Creatives again.
 */
export const CreativesWindDownNotice = () => {
  const { t } = useTranslation();

  return (
    <Alert variant="warning" role="status">
      <AlertTitle>{t("workspace.creatives.wind_down_title")}</AlertTitle>
      <AlertDescription>{t("workspace.creatives.wind_down_description")}</AlertDescription>
    </Alert>
  );
};
