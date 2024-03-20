import ResponsePage from "@/app/share/[sharingKey]/(analysis)/responses/components/ResponsePage";
import { notFound } from "next/navigation";

import { RESPONSES_PER_PAGE, REVALIDATION_INTERVAL, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponsePersonAttributes } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";

export const revalidate = REVALIDATION_INTERVAL;

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

  const tags = await getTagsByEnvironmentId(environment.id);
  const attributes = await getResponsePersonAttributes(surveyId);

  return (
    <>
      <ResponsePage
        environment={environment}
        survey={survey}
        surveyId={surveyId}
        webAppUrl={WEBAPP_URL}
        product={product}
        sharingKey={params.sharingKey}
        environmentTags={tags}
        attributes={attributes}
        responsesPerPage={RESPONSES_PER_PAGE}
      />
    </>
  );
}
