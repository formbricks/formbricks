import { getAnalysisData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import SummaryPage from "@/app/(app)/share/[sharingKey]/(analysis)/summary/components/SummaryPage";
import { getResultShareUrlSurveyAction } from "@/app/(app)/share/[sharingKey]/action";
import { redirect } from "next/navigation";

import { REVALIDATION_INTERVAL, TEXT_RESPONSES_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";

export const revalidate = REVALIDATION_INTERVAL;

export default async function Page({ params }) {
  const surveyId = await getResultShareUrlSurveyAction(params.sharingKey);

  if (!surveyId) {
    return redirect(`/`);
  }

  const survey = await getSurvey(surveyId);

  if (!survey) {
    throw new Error("Survey not found");
  }

  const [{ responses, displayCount }, environment] = await Promise.all([
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
      <SummaryPage
        environment={environment}
        responses={responses}
        survey={survey}
        sharingKey={params.sharingKey}
        surveyId={survey.id}
        product={product}
        environmentTags={tags}
        displayCount={displayCount}
        responsesPerPage={TEXT_RESPONSES_PER_PAGE}
      />
    </>
  );
}
