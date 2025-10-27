"use client";

import { useTranslation } from "react-i18next";

export const DefaultTag = () => {
  const { t } = useTranslation();
  return (
    <div className="flex h-6 items-center justify-center rounded-xl bg-slate-200 px-3">
      <p className="text-xs">{t("common.default")}</p>
    </div>
  );
};
