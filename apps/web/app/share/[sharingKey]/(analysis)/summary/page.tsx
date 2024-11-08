import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { SummaryPage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { DEFAULT_LOCALE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
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
  const [environment, attributeClasses, product] = await Promise.all([
    getEnvironment(environmentId),
    getAttributeClasses(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
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
          attributeClasses={attributeClasses}
          isAIEnabled={false} // Disable AI for sharing page for now
          locale={DEFAULT_LOCALE}
        />
      </PageContentWrapper>
    </div>
  );
};

export default Page;
