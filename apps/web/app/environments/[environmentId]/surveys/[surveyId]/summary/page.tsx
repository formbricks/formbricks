import ContentWrapper from "@/components/shared/ContentWrapper";
import SurveyResultsTabs from "../SurveyResultsTabs";
import SummaryList from "./SummaryList";
import SummaryMetadata from "./SummaryMetadata";
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";

export default function SummaryPage({ params }) {
  return (
    <>
      <SurveyResultsTabs activeId="summary" environmentId={params.environmentId} surveyId={params.surveyId} />
      <ResponsesLimitReachedBanner environmentId={params.environmentId} surveyId={params.surveyId} />
      <ContentWrapper>
        <SummaryMetadata surveyId={params.surveyId} environmentId={params.environmentId} />
        <SummaryList environmentId={params.environmentId} surveyId={params.surveyId} />
      </ContentWrapper>
    </>
  );
}
