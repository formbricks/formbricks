import SurveyList from "./SurveyList";
import ContentWrapper from "@/components/shared/ContentWrapper";

export default async function SurveysPage({ params }) {
  return (
    <ContentWrapper>
      <SurveyList environmentId={params.environmentId} />
    </ContentWrapper>
  );
}
