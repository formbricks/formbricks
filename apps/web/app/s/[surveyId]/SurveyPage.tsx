"use client";

import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import SurveyInactive from "@/app/s/[surveyId]/SurveyInactive";
import LegalFooter from "@/components/shared/LegalFooter";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useLinkSurvey } from "@/lib/linkSurvey/linkSurvey";

interface SurveyPageProps {
  surveyId: string;
}

export default function SurveyPage({ surveyId }: SurveyPageProps) {
  const { survey, isLoadingSurvey, isErrorSurvey } = useLinkSurvey(surveyId);

  if (isLoadingSurvey) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorSurvey && isErrorSurvey.status === 404) {
    return <SurveyInactive status="not found" />;
  }

  if (isErrorSurvey && isErrorSurvey.status === 403) {
    return <SurveyInactive status={isErrorSurvey.info.reason} />;
  }

  return (
    <>
      <LinkSurvey survey={survey} />
      <LegalFooter />
    </>
  );
}
