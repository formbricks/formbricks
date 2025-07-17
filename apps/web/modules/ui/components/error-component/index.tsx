"use client";

import { useTranslate } from "@tolgee/react";
import { XCircleIcon } from "lucide-react";

interface ErrorComponentProps {
  /** Pre-translated title text. If not provided, uses default error title */
  title?: string;
  /** Pre-translated description text. If not provided, uses default error description */
  description?: string;
}

export const ErrorComponent: React.FC<ErrorComponentProps> = ({ title, description }) => {
  const { t } = useTranslate();

  return (
    <div className="rounded-lg bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-12 w-12 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800" data-testid="error-title">
            {title || t("common.error_component_title")}
          </h3>
          <div className="mt-2 text-sm text-red-700" data-testid="error-description">
            <p>{description || t("common.error_component_description")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
