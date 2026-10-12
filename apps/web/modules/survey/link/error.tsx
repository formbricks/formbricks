"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { reportBoundaryError } from "@/lib/sentry/boundary-error";
import { Button } from "@/modules/ui/components/button";

interface LinkSurveyErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export const LinkSurveyError = ({ error, retry }: Readonly<LinkSurveyErrorProps>) => {
  const { t } = useTranslation();

  useEffect(() => {
    reportBoundaryError(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-between bg-linear-to-br from-slate-200 to-slate-50 px-4 py-8 text-center">
      <div className="my-auto flex flex-col items-center gap-y-3 text-slate-300">
        <TriangleAlertIcon className="size-20" />
        <h1 className="text-4xl font-bold text-slate-800">{t("common.something_went_wrong")}</h1>
        <p className="text-lg leading-10 text-slate-500">{t("s.error_description")}</p>
        <Button className="mt-2" onClick={() => retry()}>
          {t("common.try_again")}
        </Button>
      </div>
    </div>
  );
};
