import { ShareSurveyLink } from "@/modules/analysis/components/ShareSurveyLink";
import { Badge } from "@/modules/ui/components/badge";
import { useTranslate } from "@tolgee/react";
import { BellRing, BlocksIcon, Share2Icon, UserIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";

interface SuccessViewProps {
  survey: TSurvey;
  surveyUrl: string;
  publicDomain: string;
  setSurveyUrl: (url: string) => void;
  user: TUser;
  tabs: { id: string; label: string; icon: React.ElementType }[];
  handleViewChange: (view: string) => void;
  handleEmbedViewWithTab: (tabId: string) => void;
  isReadOnly: boolean;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  survey,
  surveyUrl,
  publicDomain,
  setSurveyUrl,
  user,
  tabs,
  handleViewChange,
  handleEmbedViewWithTab,
  isReadOnly,
}) => {
  const { t } = useTranslate();
  const environmentId = survey.environmentId;
  return (
    <div className="flex h-full max-w-full flex-col overflow-hidden">
      {survey.type === "link" && (
        <div className="flex h-2/5 w-full flex-col items-center justify-center gap-8 py-[100px] text-center">
          <p className="text-xl font-semibold text-slate-900">
            {t("environments.surveys.summary.your_survey_is_public")} 🎉
          </p>
          <ShareSurveyLink
            survey={survey}
            surveyUrl={surveyUrl}
            publicDomain={publicDomain}
            setSurveyUrl={setSurveyUrl}
            locale={user.locale}
            enforceSurveyUrlWidth
            isReadOnly={isReadOnly}
          />
        </div>
      )}
      <div className="flex h-full flex-col items-center justify-center gap-8 rounded-b-lg bg-slate-50 px-8 py-4">
        <p className="text-sm font-medium text-slate-900">{t("environments.surveys.summary.whats_next")}</p>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleViewChange("share")}
            className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-center text-sm text-slate-900 hover:border-slate-200 md:p-8">
            <Share2Icon className="h-8 w-8 stroke-1 text-slate-900" />
            {t("environments.surveys.summary.share_survey")}
          </button>
          <button
            type="button"
            onClick={() => handleEmbedViewWithTab(tabs[1].id)}
            className="relative flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-center text-sm text-slate-900 hover:border-slate-200 md:p-8">
            <UserIcon className="h-8 w-8 stroke-1 text-slate-900" />
            {t("environments.surveys.summary.use_personal_links")}
            <Badge size="normal" type="success" className="absolute right-3 top-3" text={t("common.new")} />
          </button>
          <Link
            href={`/environments/${environmentId}/settings/notifications`}
            className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-center text-sm text-slate-900 hover:border-slate-200 md:p-8">
            <BellRing className="h-8 w-8 stroke-1 text-slate-900" />
            {t("environments.surveys.summary.configure_alerts")}
          </Link>
          <Link
            href={`/environments/${environmentId}/integrations`}
            className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-center text-sm text-slate-900 hover:border-slate-200 md:p-8">
            <BlocksIcon className="h-8 w-8 stroke-1 text-slate-900" />
            {t("environments.surveys.summary.setup_integrations")}
          </Link>
        </div>
      </div>
    </div>
  );
};
