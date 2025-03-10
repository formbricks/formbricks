"use client";

import { ShareSurveyLink } from "@/modules/analysis/components/ShareSurveyLink";
import { useTranslate } from "@tolgee/react";
import { QRCodeSVG } from "qrcode.react";
import { TUserLocale } from "@formbricks/types/user";

interface QrProps {
  survey: any;
  surveyUrl: string;
  setSurveyUrl: React.Dispatch<React.SetStateAction<string>>;
  webAppUrl: string;
  locale: TUserLocale;
}

export const Qr = ({ survey, surveyUrl, setSurveyUrl, webAppUrl, locale }: QrProps) => {
  const { t } = useTranslate();

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex flex-grow flex-col items-center justify-center px-6 py-8">
        <ShareSurveyLink
          survey={survey}
          webAppUrl={webAppUrl}
          surveyUrl={surveyUrl}
          setSurveyUrl={setSurveyUrl}
          locale={locale}
        />
        <div className="mt-6 flex w-full max-w-sm flex-col items-center rounded-lg p-6">
          <p className="mb-4 text-lg font-semibold text-gray-800">
            {t("environments.surveys.summary.scan_Qr_Code")}
          </p>

          <QRCodeSVG value={surveyUrl} size={400} className="rounded-lg p-6 shadow-md shadow-sm" />
        </div>
      </div>
    </div>
  );
};
