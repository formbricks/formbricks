"use client";

import { useTranslation } from "react-i18next";

/**
 * The surveys linking a field that the reader is not allowed to see: counted, never named (ENG-6811).
 * Renders nothing when there are none, so a list of visible surveys reads exactly as before.
 */
export const HiddenSurveysItem = ({ count }: Readonly<{ count: number }>) => {
  const { t } = useTranslation();
  if (count <= 0) return null;

  return (
    <li className="text-sm text-slate-500">
      {t("workspace.embedded_data.used_in_surveys_you_cannot_see", { count })}
    </li>
  );
};
