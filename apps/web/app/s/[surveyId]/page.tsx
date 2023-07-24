export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import LegalFooter from "@/components/shared/LegalFooter";
import { getSurvey } from "@formbricks/lib/services/survey";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";

export default async function LinkSurveyPage({ params }) {
  const survey = await getSurvey(params.surveyId);
  const product = await getProductByEnvironmentId(params.environmentId)

  return (
    <>
      {survey && <>
        <LinkSurvey survey={survey} product={product} />
        <LegalFooter />
      </>}
    </>
  );
}
