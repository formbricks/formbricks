"use client";

import LegalFooter from "@/app/s/[surveyId]/LegalFooter";
import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import SurveyInactive from "@/app/s/[surveyId]/SurveyInactive";
import { useLinkSurvey } from "@/lib/linkSurvey/linkSurvey";
import { LoadingSpinner } from "@formbricks/ui";

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
    return (
      <SurveyInactive
        status={isErrorSurvey.info.reason}
        surveyClosedMessage={isErrorSurvey.info?.surveyClosedMessage}
      />
    );
  }

  return (
    <>
      <LinkSurvey survey={survey} />
      <LegalFooter />
    </>
  );
}
