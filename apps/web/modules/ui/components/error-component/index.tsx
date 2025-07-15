"use client";

import { useTranslate } from "@tolgee/react";
import { XCircleIcon } from "lucide-react";

interface ErrorComponentProps {
  title?: string;
  description?: string;
}

export const ErrorComponent: React.FC<ErrorComponentProps> = ({ title, description }) => {
  const { t } = useTranslate();

  // Use custom title/description if provided, otherwise fallback to translations
  const errorTitle = title || "common.error_component_title";
  const errorDescription = description || "common.error_component_description";

  return (
    <div className="rounded-lg bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-12 w-12 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800" data-testid="error-title">
            {t(errorTitle)}
          </h3>
          <div className="mt-2 text-sm text-red-700" data-testid="error-description">
            <p>{t(errorDescription)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
