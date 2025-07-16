import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { SummaryPage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { getSurveySummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getEnvironment } from "@/lib/environment/service";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@/lib/survey/service";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { notFound } from "next/navigation";

type Params = Promise<{
  sharingKey: string;
}>;

interface SummaryPageProps {
  params: Params;
}

const Page = async (props: SummaryPageProps) => {
  await applyIPRateLimit(rateLimitConfigs.share.url);

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

  // Fetch initial survey summary data on the server to prevent duplicate API calls during hydration
  const initialSurveySummary = await getSurveySummary(surveyId);

  const publicDomain = getPublicDomain();

  return (
    <div className="flex w-full justify-center">
      <PageContentWrapper className="w-full">
        <PageHeader pageTitle={survey.name}>
          <SurveyAnalysisNavigation survey={survey} environmentId={environment.id} activeId="summary" />
        </PageHeader>
        <SummaryPage
          environment={environment}
          survey={survey}
          surveyId={survey.id}
          publicDomain={publicDomain}
          isReadOnly={true}
          locale={DEFAULT_LOCALE}
          initialSurveySummary={initialSurveySummary}
        />
      </PageContentWrapper>
    </div>
  );
};

export default Page;
