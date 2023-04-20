import OnboardingModal from "@/components/onboarding/OnboardingModal";
import ContentWrapper from "@/components/shared/ContentWrapper";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import SurveysList from "./SurveyList";

export default async function SurveysPage({ params }) {
  return (
    <ContentWrapper className="flex h-full flex-col justify-between">
      <OnboardingModal />
      <SurveysList environmentId={params.environmentId} />
      <WidgetStatusIndicator environmentId={params.environmentId} type="mini" />
    </ContentWrapper>
  );
}
