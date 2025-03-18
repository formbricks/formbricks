"use client";

import { ShareSurveyLink } from "@/modules/analysis/components/ShareSurveyLink";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface LinkTabProps {
  survey: TSurvey;
  webAppUrl: string;
  surveyUrl: string;
  setSurveyUrl: (url: string) => void;
  locale: TUserLocale;
}

export const LinkTab = ({ survey, webAppUrl, surveyUrl, setSurveyUrl, locale }: LinkTabProps) => {
  const { t } = useTranslate();

  const docsLinks = [
    {
      title: t("environments.surveys.summary.data_prefilling"),
      description: t("environments.surveys.summary.data_prefilling_description"),
      link: "https://formbricks.com/docs/link-surveys/data-prefilling",
    },
    {
      title: t("environments.surveys.summary.source_tracking"),
      description: t("environments.surveys.summary.source_tracking_description"),
      link: "https://formbricks.com/docs/link-surveys/source-tracking",
    },
    {
      title: t("environments.surveys.summary.create_single_use_links"),
      description: t("environments.surveys.summary.create_single_use_links_description"),
      link: "https://formbricks.com/docs/link-surveys/single-use-links",
    },
  ];

  return (
    <div className="flex h-full grow flex-col gap-6">
      <div>
        <p className="text-lg font-semibold text-slate-800">
          {t("environments.surveys.summary.share_the_link_to_get_responses")}
        </p>
        <ShareSurveyLink
          survey={survey}
          webAppUrl={webAppUrl}
          surveyUrl={surveyUrl}
          setSurveyUrl={setSurveyUrl}
          locale={locale}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <p className="pt-2 font-semibold text-slate-700">
          {t("environments.surveys.summary.you_can_do_a_lot_more_with_links_surveys")} 💡
        </p>
        <div className="grid grid-cols-2 gap-2">
          {docsLinks.map((tip) => (
            <Link
              key={tip.title}
              target="_blank"
              href={tip.link}
              className="relative w-full rounded-md border border-slate-100 bg-white px-6 py-4 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800">
              <p className="mb-1 font-semibold">{tip.title}</p>
              <p className="text-slate-500 hover:text-slate-700">{tip.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
