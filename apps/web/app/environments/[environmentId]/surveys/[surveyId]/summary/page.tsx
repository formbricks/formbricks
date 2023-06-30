export const revalidate = 0;

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/data";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { getServerSession } from "next-auth";
import SurveyResultsTabs from "../SurveyResultsTabs";
import SummaryList from "./SummaryList";
import SummaryMetadata from "./SummaryMetadata";
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";
import CustomFilter from "@/app/environments/[environmentId]/surveys/[surveyId]/CustomFilter";

export default async function SummaryPage({ params, searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const from = searchParams?.from ? new Date(searchParams.from) : undefined;
  const to = searchParams?.to ? new Date(searchParams.to) : undefined;
  const { responses: totalResponses, survey } = await getAnalysisData(session, params.surveyId);
  const { responses } = await getAnalysisData(session, params.surveyId, from, to);

  return (
    <>
      <SurveyResultsTabs activeId="summary" environmentId={params.environmentId} surveyId={params.surveyId} />
      {/* @ts-expect-error Server Component */}
      <ResponsesLimitReachedBanner
        environmentId={params.environmentId}
        session={session}
        surveyId={params.surveyId}
      />
      <ContentWrapper>
        {/* @ts-expect-error Server Component */}
        <SummaryMetadata surveyId={params.surveyId} session={session} />
        <CustomFilter
          tab="summary"
          surveyId={params.surveyId}
          environmentId={params.environmentId}
          responses={responses}
          survey={survey}
          totalResponses={totalResponses}
          from={from}
          to={to}
        />
        <SummaryList responses={responses} survey={survey} environmentId={params.environmentId} />
      </ContentWrapper>
    </>
  );
}
