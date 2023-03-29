import SurveyList from "./SurveyList";
import ContentWrapper from "@/components/shared/ContentWrapper";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";

export default async function SurveysPage({ params }) {
  return (
    <ContentWrapper className="flex h-full flex-col justify-between">
      <SurveyList environmentId={params.environmentId} />
      <WidgetStatusIndicator environmentId={params.environmentId} type="mini" />
    </ContentWrapper>
  );
}
