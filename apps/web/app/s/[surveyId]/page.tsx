export const revalidate = REVALIDATION_INTERVAL;

import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import SurveyInactive from "@/app/s/[surveyId]/SurveyInactive";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getOrCreatePersonByUserId } from "@formbricks/lib/services/person";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getSurvey } from "@formbricks/lib/services/survey";
import { verifyTokenForLinkSurvey } from "@/lib/jwt";

export default async function LinkSurveyPage({ params, searchParams }) {
  const survey = await getSurvey(params.surveyId);
  let emailVerificationStatus: string | null = null;

  if (!survey || survey.type !== "link") {
    return <SurveyInactive status="not found" />;
  }

  if (survey && survey.status !== "inProgress") {
    return <SurveyInactive status={survey.status} surveyClosedMessage={survey.surveyClosedMessage} />;
  }

  if (survey.verifyEmail) {
    const token =
      searchParams && Object.keys(searchParams).length !== 0 && searchParams.hasOwnProperty("verify")
        ? searchParams.verify
        : undefined;
    if (!token) {
      emailVerificationStatus = "not-verified";
    } else {
      try {
        const validateToken = await verifyTokenForLinkSurvey(token, survey.id);
        if (validateToken) {
          emailVerificationStatus = "verified";
        } else {
          emailVerificationStatus = "fishy";
        }
      } catch (error) {
        emailVerificationStatus = "not-verified";
      }
    }
  }

  const product = await getProductByEnvironmentId(survey.environmentId);
  const userId =
    searchParams && Object.keys(searchParams).length !== 0 && searchParams.hasOwnProperty("userId")
      ? searchParams?.get("userId")
      : undefined;
  const person = await getOrCreatePersonByUserId(userId, survey.environmentId);

  return (
    <LinkSurvey
      survey={survey}
      product={product}
      personId={person?.id}
      emailVerificationStatus={emailVerificationStatus}
    />
  );
}
