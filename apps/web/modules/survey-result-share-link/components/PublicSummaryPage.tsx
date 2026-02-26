"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SummaryDropOffs } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryDropOffs";
import { SummaryMetadata } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryMetadata";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { PublicSummaryList } from "@/modules/survey-result-share-link/components/PublicSummaryList";

interface PublicSummaryPageProps {
  survey: TSurvey;
  surveySummary: TSurveySummary;
  locale: TUserLocale;
}

export const PublicSummaryPage = ({ survey, surveySummary, locale }: PublicSummaryPageProps) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"dropOffs" | "quotas" | "impressions" | undefined>(undefined);

  const surveyMemoized = useMemo(() => {
    return replaceHeadlineRecall(survey, "default");
  }, [survey]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{survey.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("environments.surveys.summary.share_results.public_results_subtitle")}
        </p>
      </div>

      <SummaryMetadata
        surveySummary={surveySummary.meta}
        quotasCount={0}
        isLoading={false}
        tab={tab}
        setTab={setTab}
        isQuotasAllowed={false}
      />

      {tab === "dropOffs" && <SummaryDropOffs dropOff={surveySummary.dropOff} survey={surveyMemoized} />}

      <PublicSummaryList
        summary={surveySummary.summary}
        responseCount={surveySummary.meta.totalResponses}
        survey={surveyMemoized}
        locale={locale}
      />
    </div>
  );
};
