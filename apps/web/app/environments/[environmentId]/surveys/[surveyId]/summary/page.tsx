import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/data";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { getServerSession } from "next-auth";
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";
import SurveyResultsTabs from "../SurveyResultsTabs";
import SummaryList from "./SummaryList";
import SummaryMetadata from "./SummaryMetadata";

export default async function SummaryPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const { responses, responsesCount, limitReached, survey } = await getAnalysisData(session, params.surveyId);

  return (
    <>
      <SurveyResultsTabs activeId="summary" environmentId={params.environmentId} surveyId={params.surveyId} />
      <ResponsesLimitReachedBanner
        environmentId={params.environmentId}
        limitReached={limitReached}
        responsesCount={responsesCount}
      />
      <ContentWrapper>
        <SummaryMetadata
          surveyId={params.surveyId}
          environmentId={params.environmentId}
          responses={responses}
          survey={survey}
        />
        <SummaryList environmentId={params.environmentId} survey={survey} responses={responses} />
      </ContentWrapper>
    </>
  );
}
