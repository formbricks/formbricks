import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import SummaryPage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { notFound } from "next/navigation";

import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";

export default async function Page({ params }) {
  const surveyId = await getSurveyIdByResultShareKey(params.sharingKey);

  if (!surveyId) {
    return notFound();
  }

  const survey = await getSurvey(surveyId);

  if (!survey) {
    throw new Error("Survey not found");
  }
  const environment = await getEnvironment(survey.environmentId);

  if (!environment) {
    throw new Error("Environment not found");
  }

  const product = await getProductByEnvironmentId(environment.id);
  if (!product) {
    throw new Error("Product not found");
  }

  const totalResponseCount = await getResponseCountBySurveyId(surveyId);

  return (
    <div className="flex w-full justify-center">
      <PageContentWrapper className="w-full">
        <SurveyAnalysisNavigation
          surveyId={survey.id}
          environmentId={environment.id}
          activeId="summary"
          responseCount={totalResponseCount}
        />
        <SummaryPage
          environment={environment}
          survey={survey}
          surveyId={survey.id}
          webAppUrl={WEBAPP_URL}
          product={product}
          totalResponseCount={totalResponseCount}
        />
      </PageContentWrapper>
    </div>
  );
}
