import LegalFooter from "@/app/s/[surveyId]/components/LegalFooter";
import BackgroundView from "@/app/s/[surveyId]/components/BackgroundView";
import { TSurvey } from "@formbricks/types/surveys";

export default async function SurveyBg({ children, survey }: { children: React.ReactNode; survey: TSurvey }) {
  return (
    <>
      <BackgroundView isPreview={false} survey={survey} LegalFooter={LegalFooter}>
        {children}
      </BackgroundView>
    </>
  );
}
