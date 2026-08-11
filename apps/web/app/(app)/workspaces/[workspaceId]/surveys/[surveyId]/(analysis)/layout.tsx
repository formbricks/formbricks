import { Metadata } from "next";
import { ResponseFilterProvider } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { canReadSurveyInWorkspace } from "@/modules/survey/lib/survey-auth";

type Props = {
  params: Promise<{ surveyId: string; workspaceId: string }>;
};

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const params = await props.params;
  const session = await getSession();

  // The survey name and its response count are the survey owner's data: never put them in
  // the title unless the caller may actually read this survey through this workspace. The
  // page itself 404s in that case, but metadata resolves independently of it.
  if (!(await canReadSurveyInWorkspace(params.surveyId, params.workspaceId))) {
    return { title: "" };
  }

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

const SurveyLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return <ResponseFilterProvider>{children}</ResponseFilterProvider>;
};

export default SurveyLayout;
