"use client";

import { useTranslate } from "@tolgee/react";
import { XCircleIcon } from "lucide-react";
import { SubmitButton } from "src/components/buttons/submit-button";

export const ErrorCard: React.FC = () => {
  const { t } = useTranslate();

  const handleSubmit = () => {
    window.location.href = window.location.origin;
  };

  return (
    <div className="rounded-lg bg-red-50 p-8">
      <div className="flex h-16 px-2">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-12 w-12 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{t("common.deploy_token_error_title")}</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{t("common.deploy_token_error_description")}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex w-full flex-col items-center justify-center space-y-4">
        <SubmitButton
          className="bg-primary hover:bg-primary/80 text-white"
          buttonLabel={t("common.go_back")}
          isLastQuestion={false}
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
};
