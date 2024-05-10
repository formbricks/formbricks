import SummaryPage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { notFound } from "next/navigation";

import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";

export default async function Page({ params }) {
  const surveyId = await getSurveyIdByResultShareKey(params.sharingKey);

  if (!surveyId) {
    return notFound();
  }

  const [survey, environment, attributeClasses, product] = await Promise.all([
    getSurvey(params.surveyId),
    getEnvironment(params.environmentId),
    getAttributeClasses(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);

  if (!survey) {
    throw new Error("Survey not found");
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  const totalResponseCount = await getResponseCountBySurveyId(surveyId);

  return (
    <>
      <SummaryPage
        environment={environment}
        survey={survey}
        surveyId={survey.id}
        webAppUrl={WEBAPP_URL}
        product={product}
        totalResponseCount={totalResponseCount}
        attributeClasses={attributeClasses}
      />
    </>
  );
}
