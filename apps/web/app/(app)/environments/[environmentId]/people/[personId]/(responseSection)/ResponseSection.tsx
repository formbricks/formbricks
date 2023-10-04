import ResponseTimeline from "@/app/(app)/environments/[environmentId]/people/[personId]/(responseSection)/ResponseTimeline";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TTag } from "@formbricks/types/v1/tags";

export default async function ResponseSection({
  environment,
  personId,
  environmentTags,
}: {
  environment: TEnvironment;
  personId: string;
  environmentTags: TTag[];
}) {
  const responses = await getResponsesByPersonId(personId);
  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : (await getSurveys(environment.id)) ?? [];

  return (
    <>
      {responses && (
        <ResponseTimeline
          surveys={surveys}
          responses={responses}
          environment={environment}
          environmentTags={environmentTags}
        />
      )}
    </>
  );
}
