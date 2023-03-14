import ContentWrapper from "@/components/shared/ContentWrapper";
import SurveyResultsTabs from "../SurveyResultsTabs";

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
      </ContentWrapper>
    </>
  );
}
