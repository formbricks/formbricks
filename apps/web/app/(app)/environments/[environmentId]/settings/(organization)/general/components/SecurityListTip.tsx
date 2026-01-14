"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export const SecurityListTip = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl">
      <div className="flex items-center space-x-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
        <ShieldCheckIcon className="h-5 w-5 flex-shrink-0 text-blue-400" />
        <p className="text-sm">{t("environments.settings.general.security_list_tip")}</p>
      </div>
    </div>
  );
};
