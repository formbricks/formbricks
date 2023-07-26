import { getPersonWithAttributeClasses } from "@formbricks/lib/services/person";
import { getResponsesWithSurveyOfPerson } from "@formbricks/lib/services/response";
import { getSessionWithActionsOfPerson } from "@formbricks/lib/services/session";
import { getDisplaysOfPerson } from "@formbricks/lib/services/displays";
import AttributesSection from "@/app/(app)/environments/[environmentId]/people/[personId]/AttributesSection";
import ActivitySection from "@/app/(app)/environments/[environmentId]/people/[personId]/ActivitySection";
import HeadingSection from "@/app/(app)/environments/[environmentId]/people/[personId]/HeadingSection";
import ResponseSection from "@/app/(app)/environments/[environmentId]/people/[personId]/ResponseSection";

export default async function PersonPage({ params }) {
  let [personWithAttributes, displays, sessionsWithActions, responsesWithSurvey] = await Promise.all([
    getPersonWithAttributeClasses(params.personId),
    getDisplaysOfPerson(params.personId),
    getSessionWithActionsOfPerson(params.personId),
    getResponsesWithSurveyOfPerson(params.personId),
  ]);
  if (!personWithAttributes) {
    throw new Error("No such person found");
  }
  const email = personWithAttributes?.attributes?.find((attribute) => attribute.name === "email")?.value;
  const userId = personWithAttributes?.attributes?.find((attribute) => attribute.name === "userId")?.value;
  const otherAttributes = personWithAttributes?.attributes?.filter(
    (attribute) => attribute.name !== "email" && attribute.name !== "userId" && !attribute.archived
  );
  const numberOfSessions = sessionsWithActions?.length ?? 0;
  const numberOfResponses = responsesWithSurvey?.length ?? 0;

  displays = displays ?? [];
  sessionsWithActions = sessionsWithActions ?? [];
  responsesWithSurvey = responsesWithSurvey ?? [];

  const personEmail = personWithAttributes?.attributes?.find((attribute) => attribute.name === "email");

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
                userId={userId}
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
                attributes={personWithAttributes?.attributes}
                displays={displays}
              />
            </div>
          </section>
        </>
      </main>
    </div>
  );
}
