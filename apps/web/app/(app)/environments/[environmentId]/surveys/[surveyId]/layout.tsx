import { getSurvey } from "@/lib/survey/service";
import { SurveyContextWrapper } from "./context/survey-context";

interface SurveyLayoutProps {
  params: Promise<{ surveyId: string; environmentId: string }>;
  children: React.ReactNode;
}

const SurveyLayout = async ({ params, children }: SurveyLayoutProps) => {
  const resolvedParams = await params;

  const survey = await getSurvey(resolvedParams.surveyId);

  if (!survey) {
    throw new Error("Survey not found");
  }

  return <SurveyContextWrapper survey={survey}>{children}</SurveyContextWrapper>;
};

export default SurveyLayout;
