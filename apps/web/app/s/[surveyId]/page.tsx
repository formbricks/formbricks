export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import LegalFooter from "@/app/s/[surveyId]/LegalFooter";
import { getSurvey } from "@formbricks/lib/services/survey";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import SurveyInactive from "@/app/s/[surveyId]/SurveyInactive";
import { getResponseBySingleUseId } from "@formbricks/lib/services/response";
import SurveyLinkUsed from "@/app/s/[surveyId]/SurveyLinkUsed";

type LinkSurveyPageProps = {
  params: { surveyId: string };
  searchParams: { suId: string | undefined };
};

export default async function LinkSurveyPage({ params, searchParams }: LinkSurveyPageProps) {
  const survey = await getSurvey(params.surveyId);
  const singleUseId = searchParams.suId;

  if (!survey || survey.type !== "link") {
    return <SurveyInactive status="not found" />;
  }

  if (survey && survey.status !== "inProgress") {
    return <SurveyInactive status={survey.status} surveyClosedMessage={survey.surveyClosedMessage} />;
  }

  if (survey && survey.singleUse?.enabled) {
    if (!singleUseId) {
      return <SurveyInactive status="link invalid" />;
    }
    const singleUseResponse = await getResponseBySingleUseId(survey.id, singleUseId);
    if (singleUseResponse) {
      return <SurveyLinkUsed singleUseMessage={survey.singleUse} />;
    }
  }

  const product = await getProductByEnvironmentId(survey.environmentId);

  return (
    <>
      {survey && (
        <>
          <LinkSurvey
            survey={survey}
            product={product}
            singleUseId={survey.singleUse?.enabled ? singleUseId : undefined}
          />
          <LegalFooter />
        </>
      )}
    </>
  );
}
