"use client";

import { useTranslation } from "react-i18next";

export const ActionTableHeading = () => {
  const { t } = useTranslation();
  return (
    <div className="grid h-12 grid-cols-6 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
      <span className="sr-only">{t("common.edit")}</span>
      <div className="col-span-4 pl-6">{t("environments.actions.user_actions")}</div>
      <div className="col-span-2 text-center">{t("common.created")}</div>
    </div>
  );
};
