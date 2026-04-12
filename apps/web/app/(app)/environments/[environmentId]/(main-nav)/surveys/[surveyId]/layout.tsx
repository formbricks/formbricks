import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getSurvey } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { SurveyContextWrapper } from "./context/survey-context";

interface SurveyLayoutProps {
  params: Promise<{ surveyId: string; environmentId: string }>;
  children: React.ReactNode;
}

const SurveyLayout = async ({ params, children }: SurveyLayoutProps) => {
  const resolvedParams = await params;

  const survey = await getSurvey(resolvedParams.surveyId);
  const t = await getTranslate();

  if (!survey) {
    throw new ResourceNotFoundError(t("common.survey"), resolvedParams.surveyId);
  }

  return <SurveyContextWrapper survey={survey}>{children}</SurveyContextWrapper>;
};

export default SurveyLayout;
