import ResponseTimeline from "@/app/(app)/environments/[environmentId]/people/[personId]/(responseSection)/ResponseTimeline";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TResponseWithSurvey } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";

export default async function ResponseSection({
  environment,
  personId,
}: {
  environment: TEnvironment;
  personId: string;
}) {
  const responses = await getResponsesByPersonId(personId);
  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : (await getSurveys(environment.id)) ?? [];
  const responsesWithSurvey: TResponseWithSurvey[] =
    responses?.reduce((acc: TResponseWithSurvey[], response) => {
      const thisSurvey = surveys.find((survey) => survey?.id === response.surveyId);
      if (thisSurvey) {
        acc.push({
          ...response,
          survey: thisSurvey,
        });
      }
      return acc;
    }, []) || [];

  return <ResponseTimeline environment={environment} responses={responsesWithSurvey} />;
}
