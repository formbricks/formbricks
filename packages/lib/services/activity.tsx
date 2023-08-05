import { TDisplaysWithSurveyName } from "@formbricks/types/v1/displays";
import { TPersonDetailedAttribute } from "@formbricks/types/v1/people";
import { TSessionWithActions } from "@formbricks/types/v1/sessions";
import { getDisplaysOfPerson } from "./displays";
import { getPersonWithAttributeClasses } from "./person";
import { getSessionWithActionsOfPerson } from "./session";
import { TActivityFeedItem } from "@formbricks/types/v1/activity";

export const getActivityTimeline = async (personId: string): Promise<TActivityFeedItem[]> => {
  const sessions = (await getSessionWithActionsOfPerson(personId)) ?? [];
  const displays = (await getDisplaysOfPerson(personId)) ?? [];
  const personWithAttributes = await getPersonWithAttributeClasses(personId);
  if (!personWithAttributes) {
    throw new Error("No such person found");
  }
  const { attributes } = personWithAttributes || {};

  const unifiedAttributes: TActivityFeedItem[] = attributes.map((attribute: TPersonDetailedAttribute) => ({
    id: attribute.id,
    type: "attribute",
    createdAt: attribute.createdAt,
    updatedAt: attribute.updatedAt,
    attributeLabel: attribute.name,
    attributeValue: attribute.value,
    actionLabel: null,
    actionDescription: null,
    actionType: null,
    displaySurveyName: null,
  }));
  const unifiedDisplays: TActivityFeedItem[] = displays.map((display: TDisplaysWithSurveyName) => ({
    id: display.id,
    type: "display",
    createdAt: display.createdAt,
    updatedAt: display.updatedAt,
    attributeLabel: null,
    attributeValue: null,
    actionLabel: null,
    actionDescription: null,
    actionType: null,
    displaySurveyName: display.surveyName,
  }));
  const unifiedEvents: TActivityFeedItem[] = sessions.flatMap((session: TSessionWithActions) =>
    session.events.map((event) => ({
      id: event.id,
      type: "event",
      createdAt: event.createdAt,
      updatedAt: null,
      attributeLabel: null,
      attributeValue: null,
      actionLabel: event.eventClass?.name || null,
      actionDescription: event.eventClass?.description || null,
      actionType: event.eventClass?.type || null,
      displaySurveyName: null,
    }))
  );

  const unifiedList: TActivityFeedItem[] = [...unifiedAttributes, ...unifiedDisplays, ...unifiedEvents];

  return unifiedList;
};
