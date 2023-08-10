export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import LegalFooter from "@/components/shared/LegalFooter";
import { getSurveyWithAnalytics } from "@formbricks/lib/services/survey";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";

type TEnhancedSurvey = TSurveyWithAnalytics & {
  brandColor: string;
  formbricksSignature: boolean;
};

export default async function LinkSurveyPage({ params }) {
  const survey = await getSurveyWithAnalytics(params.surveyId);
  const product = await getProductByEnvironmentId(params.environmentId);
  let enhancedSurvey: TEnhancedSurvey | null = null; // Initialize to null here

  if (survey && product) {
    enhancedSurvey = {
      ...survey,
      brandColor: product.brandColor,
      formbricksSignature: product.formbricksSignature,
    };
  }

  return (
    <>
      {enhancedSurvey && (
        <>
          <LinkSurvey survey={enhancedSurvey} />
          <LegalFooter />
        </>
      )}
    </>
  );
}
