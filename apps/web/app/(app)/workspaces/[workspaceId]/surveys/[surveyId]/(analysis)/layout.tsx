import { Metadata } from "next";
import { ResponseFilterProvider } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { canReadSurveyInWorkspace } from "@/modules/survey/lib/survey-auth";

type Props = {
  params: Promise<{ surveyId: string; workspaceId: string }>;
};

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const params = await props.params;
  const t = await getTranslate();

  // The survey name and its response count are the survey owner's data: never put them in
  // the title unless the caller may actually read this survey through this workspace. The
  // page itself 404s in that case, but metadata resolves independently of it. This is a
  // layout, so the fallback is also the title of the 404 rendered underneath it — a neutral
  // word rather than an empty string, which makes the browser show the raw URL instead.
  // The guard covers the unauthenticated case too, so there is no session check here.
  if (!(await canReadSurveyInWorkspace(params.workspaceId, params.surveyId))) {
    return { title: t("common.survey") };
  }

  const [survey, responseCount] = await Promise.all([
    getSurvey(params.surveyId),
    getResponseCountBySurveyId(params.surveyId),
  ]);

  return {
    title: `${t("common.count_responses", { count: responseCount })} | ${t("workspace.surveys.summary.survey_results", { surveyName: survey?.name })}`,
  };
};

const SurveyLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return <ResponseFilterProvider>{children}</ResponseFilterProvider>;
};

export default SurveyLayout;
