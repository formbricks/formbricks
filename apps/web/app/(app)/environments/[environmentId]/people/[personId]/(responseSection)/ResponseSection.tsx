import ResponseTimeline from "@/app/(app)/environments/[environmentId]/people/[personId]/(responseSection)/ResponseTimeline";
import { getResponsesByPersonId } from "@formbricks/lib/services/response";
import { getSurveys } from "@formbricks/lib/services/survey";
import { TSurvey } from "@formbricks/types/v1/surveys";

export default async function ResponseSection({
  environmentId,
  personId,
}: {
  environmentId: string;
  personId: string;
}) {
  const responses = await getResponsesByPersonId(personId);
  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : (await getSurveys(environmentId)) ?? [];

  return (
    <>
      {responses && (
        <ResponseTimeline surveys={surveys} responses={responses} environmentId={environmentId} />
      )}
    </>
  );
}
