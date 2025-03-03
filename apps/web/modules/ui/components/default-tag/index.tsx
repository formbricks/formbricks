"use client";

import { useTranslate } from "@tolgee/react";

export const DefaultTag = () => {
  const { t } = useTranslate();
  return (
    <div className="flex h-6 items-center justify-center rounded-xl bg-slate-200 px-3">
      <p className="text-xs">{t("common.default")}</p>
    </div>
  );
};
