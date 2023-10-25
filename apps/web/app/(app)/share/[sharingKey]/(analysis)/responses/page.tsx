export const revalidate = REVALIDATION_INTERVAL;

import { getAnalysisDataForSharing } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import ResponsePage from "@/app/(app)/share/[sharingKey]/(analysis)/responses/components/ResponsePage";
import { RESPONSES_PER_PAGE, REVALIDATION_INTERVAL, SURVEY_BASE_URL } from "@formbricks/lib/constants";

export default async function Page({ params }) {
  const [{ responses, survey }] = await Promise.all([getAnalysisDataForSharing(params.sharingKey)]);

  return (
    <>
      <ResponsePage
        responses={responses}
        survey={survey}
        surveyId={params.surveyId}
        surveyBaseUrl={SURVEY_BASE_URL}
        responsesPerPage={RESPONSES_PER_PAGE}
      />
    </>
  );
}
