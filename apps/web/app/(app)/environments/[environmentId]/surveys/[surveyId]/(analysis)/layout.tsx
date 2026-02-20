import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { useTranslation } from "react-i18next";

type Props = {
  params: Promise<{ surveyId: string; environmentId: string }>;
};

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const survey = await getSurvey(params.surveyId);
  const responseCount = await getResponseCountBySurveyId(params.surveyId);
  const { t } = useTranslation();

  if (session) {
    return {
      title: `${t("common.count_responses", { count: responseCount })} | ${t("environments.surveys.summary.survey_results", { surveyName: survey?.name })}`,
    };
  }
  return {
    title: "",
  };
};

const SurveyLayout = async ({ children }) => {
  return <ResponseFilterProvider>{children}</ResponseFilterProvider>;
};

export default SurveyLayout;
