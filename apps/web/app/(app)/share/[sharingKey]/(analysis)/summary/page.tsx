export const revalidate = REVALIDATION_INTERVAL;

import { getAnalysisData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import SummaryPage from "@/app/(app)/share/[sharingKey]/(analysis)/summary/components/SummaryPage";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getResponseSharingKeySurveyAction } from "@/app/(app)/share/[sharingKey]/action";
import { OPEN_TEXT_RESPONSES_PER_PAGE, REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { redirect } from "next/navigation";

export default async function Page({ params }) {
  const surveyId = await getResponseSharingKeySurveyAction(params.sharingKey);

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
        openTextResponsesPerPage={OPEN_TEXT_RESPONSES_PER_PAGE}
      />
    </>
  );
}
