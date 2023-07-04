export const revalidate = 0;

import ContentWrapper from "@/components/shared/ContentWrapper";
import SurveyResultsTabs from "../SurveyResultsTabs";
import ResponseTimeline from "./ResponseTimeline";
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/data";

export default async function ResponsesPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const { responses, survey } = await getAnalysisData(session, params.surveyId);
  return (
    <>
      <SurveyResultsTabs
        activeId="responses"
        environmentId={params.environmentId}
        surveyId={params.surveyId}
      />
      <ResponsesLimitReachedBanner
        environmentId={params.environmentId}
        surveyId={params.surveyId}
        session={session}
      />
      <ContentWrapper>
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
