import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/engagements/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { SummaryPage } from "@/app/(app)/environments/[environmentId]/engagements/[surveyId]/(analysis)/summary/components/SummaryPage";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { notFound } from "next/navigation";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";

type Params = Promise<{
  sharingKey: string;
}>;

interface SummaryPageProps {
  params: Params;
}

const Page = async (props: SummaryPageProps) => {
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

  const [environment, project] = await Promise.all([
    getEnvironment(environmentId),
    getProjectByEnvironmentId(environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const totalResponseCount = await getResponseCountBySurveyId(surveyId);

  return (
    <div className="flex w-full justify-center">
      <PageContentWrapper className="w-full">
        <PageHeader pageTitle={survey.name}>
          <SurveyAnalysisNavigation
            survey={survey}
            environmentId={environment.id}
            activeId="summary"
            initialTotalResponseCount={totalResponseCount}
          />
        </PageHeader>
        <SummaryPage
          environment={environment}
          survey={survey}
          surveyId={survey.id}
          webAppUrl={WEBAPP_URL}
          totalResponseCount={totalResponseCount}
          isReadOnly={true}
        />
      </PageContentWrapper>
    </div>
  );
};

export default Page;
