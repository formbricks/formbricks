import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { SummaryPage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { notFound } from "next/navigation";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }) => {
  const surveyId = await getSurveyIdByResultShareKey(params.sharingKey);

  if (!surveyId) {
    return notFound();
  }

  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error("Survey not found");
  }
  const environmentId = survey.environmentId;
  const [environment, attributeClasses, product] = await Promise.all([
    getEnvironment(environmentId),
    getAttributeClasses(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!product) {
    throw new Error("Product not found");
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
        />
      </PageContentWrapper>
    </div>
  );
};

export default Page;
