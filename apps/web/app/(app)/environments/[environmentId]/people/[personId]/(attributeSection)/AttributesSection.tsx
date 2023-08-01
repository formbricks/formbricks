export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";

import { capitalizeFirstLetter } from "@/lib/utils";
import { getPersonWithAttributeClasses } from "@formbricks/lib/services/person";
import { getSessionCount } from "@formbricks/lib/services/session";
import { getResponsesByPersonId } from "@formbricks/lib/services/response";
import { getSurveys } from "@formbricks/lib/services/survey";
import { TResponseWithSurveyData } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";

export default async function AttributesSection({
  personId,
  environmentId,
}: {
  personId: string;
  environmentId: string;
}) {
  const personWithAttributes = await getPersonWithAttributeClasses(personId);
  if (!personWithAttributes) {
    throw new Error("No such person found");
  }
  const numberOfSessions = await getSessionCount(personId);

  const { attributes } = personWithAttributes || {};
  const userId = attributes?.find((attribute) => attribute.name === "userId")?.value;
  const otherAttributes = attributes?.filter(
    (attribute) => attribute.name !== "email" && attribute.name !== "userId" && !attribute.archived
  );
  const personEmail = attributes?.find((attribute) => attribute.name === "email");
  const email = personEmail?.value;

  const responses = await getResponsesByPersonId(personId);

  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : (await getSurveys(environmentId)) ?? [];

  const responsesWithSurvey: TResponseWithSurveyData[] =
    responses?.reduce((acc: TResponseWithSurveyData[], response) => {
      const thisSurvey = surveys.find((survey) => survey?.id === response.surveyId);
      if (thisSurvey) {
        acc.push({
          id: response.id,
          createdAt: response.createdAt,
          data: response.data,
          survey: {
            id: response.surveyId,
            name: thisSurvey.name,
            status: thisSurvey.status,
            questions: thisSurvey.questions,
          },
        });
      }
      return acc;
    }, []) || [];

  const numberOfResponses = responsesWithSurvey.length;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">Attributes</h2>
      <div>
        <dt className="text-sm font-medium text-slate-500">Email</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {email ? <span>{email}</span> : <span className="text-slate-300">Not provided</span>}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">User Id</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {userId ? <span>{userId}</span> : <span className="text-slate-300">Not provided</span>}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">Formbricks Id (internal)</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{personWithAttributes?.id}</dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-slate-500">Sessions</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfSessions}</dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">Responses</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfResponses}</dd>
      </div>
      {otherAttributes.map((attribute) => (
        <div key={attribute.name}>
          <dt className="text-sm font-medium text-slate-500">{capitalizeFirstLetter(attribute.name)}</dt>
          <dd className="mt-1 text-sm text-slate-900">{attribute.value}</dd>
        </div>
      ))}
    </div>
  );
}
