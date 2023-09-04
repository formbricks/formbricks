export const revalidate = REVALIDATION_INTERVAL;

import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import SurveyInactive from "@/app/s/[surveyId]/SurveyInactive";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getOrCreatePersonByUserId } from "@formbricks/lib/services/person";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getSurvey } from "@formbricks/lib/services/survey";

export default async function LinkSurveyPage({ params, searchParams }) {
  const survey = await getSurvey(params.surveyId);

  if (!survey || survey.type !== "link") {
    return <SurveyInactive status="not found" />;
  }

  if (survey && survey.status !== "inProgress") {
    return <SurveyInactive status={survey.status} surveyClosedMessage={survey.surveyClosedMessage} />;
  }
  

  const product = await getProductByEnvironmentId(survey.environmentId);
  const userId = (searchParams && Object.keys(searchParams).length !== 0 && searchParams.hasOwnProperty("userId")) ? searchParams?.get("userId") : undefined 

  const person = await getOrCreatePersonByUserId(userId, survey.environmentId);

  return <LinkSurvey survey={survey} product={product} personId={person?.id} />;
}
