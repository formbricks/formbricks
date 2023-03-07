import SurveyList from "@/components/surveys/SurveyList";
import ContentWrapper from "@/components/ui/ContentWrapper";

export default async function SurveysPage({ params }) {
  return (
    <ContentWrapper>
      <SurveyList environmentId={params.environmentId} />
    </ContentWrapper>
  );
}
