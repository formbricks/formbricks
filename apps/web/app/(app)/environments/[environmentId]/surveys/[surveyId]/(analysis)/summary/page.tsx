export const revalidate = REVALIDATION_INTERVAL;

import ResponsesLimitReachedBanner from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/ResponsesLimitReachedBanner";
import { getAnalysisData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import SummaryPage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { REVALIDATION_INTERVAL, SURVEY_BASE_URL } from "@formbricks/lib/constants";
import { getServerSession } from "next-auth";
import { generateSurveySingleUseId } from "@/lib/surveys/surveys";

const generateSingleUseIds = (isEncrypted: boolean) => {
  return Array(5)
    .fill(null)
    .map(() => {
      return generateSurveySingleUseId(isEncrypted);
    });
};

export default async function Page({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const { responses, survey } = await getAnalysisData(params.surveyId, params.environmentId);
  const isSingleUseSurvey = survey.singleUse?.enabled ?? false;
  const singleUseIds = generateSingleUseIds(survey.singleUse?.isEncrypted ?? false);

  return (
    <>
      <ResponsesLimitReachedBanner environmentId={params.environmentId} surveyId={params.surveyId} />
      <SummaryPage
        environmentId={params.environmentId}
        responses={responses}
        survey={survey}
        surveyId={params.surveyId}
        surveyBaseUrl={SURVEY_BASE_URL}
        singleUseIds={isSingleUseSurvey ? singleUseIds : undefined}
      />
    </>
  );
}
