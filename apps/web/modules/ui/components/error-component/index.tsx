"use client";

import { useTranslate } from "@tolgee/react";
import { XCircleIcon } from "lucide-react";

export const ErrorComponent: React.FC = () => {
  const { t } = useTranslate();
  return (
    <div className="rounded-lg bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-12 w-12 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{t("common.error_component_title")}</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{t("common.error_component_description")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
