export const revalidate = REVALIDATION_INTERVAL;

import { getAnalysisData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import ResponsePage from "@/app/(app)/share/[sharingKey]/(analysis)/responses/components/ResponsePage";
import { RESPONSES_PER_PAGE, REVALIDATION_INTERVAL, SURVEY_BASE_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getSurvey } from "@formbricks/lib/survey/service";

export default async function Page({ params }) {
  const survey = await getSurvey(params.sharingKey);

  if (!survey) {
    throw new Error("Survey not found");
  }

  const [{ responses }, environment] = await Promise.all([
    getAnalysisData(survey.id, survey.environmentId),
    getEnvironment(survey.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }
  const product = await getProductByEnvironmentId(environment.id);
  if (!product) {
    throw new Error("Product not found");
  }

  const tags = await getTagsByEnvironmentId(environment.id);

  return (
    <>
      <ResponsePage
        environment={environment}
        responses={responses}
        survey={survey}
        surveyId={params.surveyId}
        surveyBaseUrl={SURVEY_BASE_URL}
        product={product}
        sharingKey={params.sharingKey}
        environmentTags={tags}
        responsesPerPage={RESPONSES_PER_PAGE}
      />
    </>
  );
}
