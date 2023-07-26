import { getPersonWithAttributeClasses } from "@formbricks/lib/services/person";
import { getResponsesByPersonId } from "@formbricks/lib/services/response";
import { getSessionWithActionsOfPerson } from "@formbricks/lib/services/session";
import { getDisplaysOfPerson } from "@formbricks/lib/services/displays";
import { getSurvey } from "@formbricks/lib/services/survey";
import AttributesSection from "@/app/(app)/environments/[environmentId]/people/[personId]/AttributesSection";
import ActivitySection from "@/app/(app)/environments/[environmentId]/people/[personId]/ActivitySection";
import HeadingSection from "@/app/(app)/environments/[environmentId]/people/[personId]/HeadingSection";
import ResponseSection from "@/app/(app)/environments/[environmentId]/people/[personId]/ResponseSection";
import { TResponseWithSurveyData } from "@formbricks/types/v1/responses";

export default async function PersonPage({ params }) {
  let [personWithAttributes, displays, sessionsWithActions, responses] = await Promise.all([
    getPersonWithAttributeClasses(params.personId),
    getDisplaysOfPerson(params.personId),
    getSessionWithActionsOfPerson(params.personId),
    getResponsesByPersonId(params.personId),
  ]);

  if (!personWithAttributes) {
    throw new Error("No such person found");
  }
  sessionsWithActions = sessionsWithActions ?? [];
  displays = displays ?? [];

  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys = await Promise.all(surveyIds.map((surveyIdx) => getSurvey(surveyIdx)));

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

  const numberOfSessions = sessionsWithActions?.length ?? 0;
  const numberOfResponses = responsesWithSurvey.length;

  const { attributes } = personWithAttributes || {};
  const userIdAttribute = attributes?.find((attribute) => attribute.name === "userId");
  const otherAttributes = attributes?.filter(
    (attribute) => attribute.name !== "email" && attribute.name !== "userId" && !attribute.archived
  );
  const personEmail = attributes?.find((attribute) => attribute.name === "email");
  const email = personEmail?.value;

  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <>
          <HeadingSection
            environmentId={params.environmentId}
            personEmail={personEmail}
            personId={personWithAttributes.id}
          />
          <section className="pb-24 pt-6">
            <div className="grid grid-cols-1 gap-x-8  md:grid-cols-4">
              <AttributesSection
                email={email}
                userId={userIdAttribute?.value}
                otherAttributes={otherAttributes}
                personWithAttributes={personWithAttributes}
                numberOfSessions={numberOfSessions}
                numberOfResponses={numberOfResponses}
              />
              <ResponseSection
                environmentId={params.environmentId}
                responsesWithSurveyData={responsesWithSurvey}
              />

              <ActivitySection
                environmentId={params.environmentId}
                sessionsWithActions={sessionsWithActions}
                attributes={attributes}
                displays={displays}
              />
            </div>
          </section>
        </>
      </main>
    </div>
  );
}
