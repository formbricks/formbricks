export const revalidate = 0;

import ContentWrapper from "@/components/shared/ContentWrapper";
import SurveyResultsTabs from "../SurveyResultsTabs";
import ResponseTimeline from "./ResponseTimeline";
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";
import CustomFilter from "../CustomFilter";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/data";

export default async function ResponsesPage({ params, searchParams }) {
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
      <SurveyResultsTabs
        activeId="responses"
        environmentId={params.environmentId}
        surveyId={params.surveyId}
      />
      {/* @ts-expect-error Server Component */}
      <ResponsesLimitReachedBanner
        environmentId={params.environmentId}
        surveyId={params.surveyId}
        session={session}
      />
      <ContentWrapper>
        <CustomFilter
          to={to}
          from={from}
          tab="responses"
          surveyId={params.surveyId}
          environmentId={params.environmentId}
          responses={responses}
          survey={survey}
          totalResponses={totalResponses}
        />
        <ResponseTimeline
          environmentId={params.environmentId}
          surveyId={params.surveyId}
          responses={responses}
          survey={survey}
        />
      </ContentWrapper>
    </>
  );
}
