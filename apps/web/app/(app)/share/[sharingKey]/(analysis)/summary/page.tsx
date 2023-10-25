// export default function EnvironmentPage({ params }) {
//   return <div>{params.sharingKey}</div>;
// }

export const revalidate = REVALIDATION_INTERVAL;

import { getAnalysisDataForSharing } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import SummaryPage from "@/app/(app)/share/[sharingKey]/(analysis)/summary/components/SummaryPage";

import {
  OPEN_TEXT_RESPONSES_PER_PAGE,
  REVALIDATION_INTERVAL,
  SURVEY_BASE_URL,
} from "@formbricks/lib/constants";

export default async function Page({ params }) {
  const [{ responses, survey, displayCount }] = await Promise.all([
    getAnalysisDataForSharing(params.sharingKey),
  ]);

  return (
    <>
      <SummaryPage
        responses={responses}
        survey={survey}
        surveyId={params.surveyId}
        surveyBaseUrl={SURVEY_BASE_URL}
        displayCount={displayCount}
        openTextResponsesPerPage={OPEN_TEXT_RESPONSES_PER_PAGE}
      />
    </>
  );
}
