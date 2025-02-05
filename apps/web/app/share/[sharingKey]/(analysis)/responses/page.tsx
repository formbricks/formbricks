import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { notFound } from "next/navigation";
import { RESPONSES_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";

type Params = Promise<{
  sharingKey: string;
}>;

interface ResponsesPageProps {
  params: Params;
}

const Page = async (props: ResponsesPageProps) => {
  const t = await getTranslate();
  const params = await props.params;
  const surveyId = await getSurveyIdByResultShareKey(params.sharingKey);

  if (!surveyId) {
    return notFound();
  }
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error(t("common.survey_not_found"));
  }
  const environmentId = survey.environmentId;
  const [environment, project, tags] = await Promise.all([
    getEnvironment(environmentId),
    getProjectByEnvironmentId(environmentId),
    getTagsByEnvironmentId(environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const totalResponseCount = await getResponseCountBySurveyId(surveyId);
  const locale = await findMatchingLocale();

  return (
    <div className="flex w-full justify-center">
      <PageContentWrapper className="w-full">
        <PageHeader pageTitle={survey.name}>
          <SurveyAnalysisNavigation
            survey={survey}
            environmentId={environment.id}
            activeId="responses"
            initialTotalResponseCount={totalResponseCount}
          />
        </PageHeader>
        <ResponsePage
          environment={environment}
          survey={survey}
          surveyId={surveyId}
          webAppUrl={WEBAPP_URL}
          environmentTags={tags}
          responsesPerPage={RESPONSES_PER_PAGE}
          locale={locale}
          isReadOnly={true}
        />
      </PageContentWrapper>
    </div>
  );
};

export default Page;
