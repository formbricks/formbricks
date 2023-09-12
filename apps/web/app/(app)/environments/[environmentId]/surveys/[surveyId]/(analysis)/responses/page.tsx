export const revalidate = REVALIDATION_INTERVAL;

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import ResponsePage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/ResponsePage";
import { getAnalysisData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import { getServerSession } from "next-auth";
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { SURVEY_BASE_URL } from "@formbricks/lib/constants";

export default async function Page({ params }) {
  const surveyBaseUrl = SURVEY_BASE_URL;
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const { responses, survey } = await getAnalysisData(params.surveyId, params.environmentId);
  return (
    <>
      <ResponsesLimitReachedBanner environmentId={params.environmentId} surveyId={params.surveyId} />
      <ResponsePage
        environmentId={params.environmentId}
        responses={responses}
        survey={survey}
        surveyId={params.surveyId}
        surveyBaseUrl={surveyBaseUrl}
      />
    </>
  );
}
