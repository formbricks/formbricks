import { Metadata } from "next";
import { ResponseFilterProvider } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";

type Props = {
  params: Promise<{ surveyId: string; workspaceId: string }>;
};

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const params = await props.params;
  const session = await getSession();
  const survey = await getSurvey(params.surveyId);
  const responseCount = await getResponseCountBySurveyId(params.surveyId);
  const t = await getTranslate();

  if (session) {
    return {
      title: `${t("common.count_responses", { count: responseCount })} | ${t("workspace.surveys.summary.survey_results", { surveyName: survey?.name })}`,
    };
  }
  return {
    title: "",
  };
};

const SurveyLayout = async ({ children }: { children: React.ReactNode }) => {
  return <ResponseFilterProvider>{children}</ResponseFilterProvider>;
};

export default SurveyLayout;
