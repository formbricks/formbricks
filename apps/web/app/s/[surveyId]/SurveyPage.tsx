"use client";

import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
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

  if (isErrorSurvey || !survey) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-slate-800">Survey cannot be found</p>
      </div>
    );
  }

  return (
    <>
      <LinkSurvey survey={survey} />
      <LegalFooter />
    </>
  );
}
