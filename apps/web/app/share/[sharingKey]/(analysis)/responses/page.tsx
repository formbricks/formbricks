import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { RESPONSES_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const surveyId = await getSurveyIdByResultShareKey(params.sharingKey);

  if (!surveyId) {
    return notFound();
  }
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error(t("common.survey_not_found"));
  }
  const environmentId = survey.environmentId;
  const [environment, product, tags] = await Promise.all([
    getEnvironment(environmentId),
    getProductByEnvironmentId(environmentId),
    getTagsByEnvironmentId(environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  if (!product) {
    throw new Error(t("common.product_not_found"));
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
