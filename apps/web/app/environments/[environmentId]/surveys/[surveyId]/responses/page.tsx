import ContentWrapper from "@/components/shared/ContentWrapper";
import SurveyResultsTabs from "../SurveyResultsTabs";
import ResponseTimeline from "./ResponseTimeline";

export default function ResponsesPage({ params }) {
  return (
    <>
      <SurveyResultsTabs
        activeId="responses"
        environmentId={params.environmentId}
        surveyId={params.surveyId}
      />
      <ContentWrapper>
        <h1>Responses List</h1>
        <ResponseTimeline environmentId={params.environmentId} surveyId={params.surveyId} />
      </ContentWrapper>
    </>
  );
}
