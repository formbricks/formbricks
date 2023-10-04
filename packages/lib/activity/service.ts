import "server-only";

import { prisma } from "@formbricks/database";
import { TActivityFeedItem } from "@formbricks/types/v1/activity";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";
import { cache } from "react";
import { ResourceNotFoundError } from "@formbricks/types/v1/errors";

export const getActivityTimeline = cache(async (personId: string): Promise<TActivityFeedItem[]> => {
  validateInputs([personId, ZId]);
  const person = await prisma.person.findUnique({
    where: {
      id: personId,
    },
    include: {
      attributes: {
        include: {
          attributeClass: true,
        },
      },
      displays: {
        include: {
          survey: true,
        },
      },
      sessions: {
        include: {
          events: {
            include: {
              eventClass: true,
            },
          },
        },
      },
    },
  });

  if (!person) {
    throw new ResourceNotFoundError("Person", personId);
  }
  const { attributes, displays, sessions } = person;

  const unifiedAttributes: TActivityFeedItem[] = attributes.map((attribute) => ({
    id: attribute.id,
    type: "attribute",
    createdAt: attribute.createdAt,
    updatedAt: attribute.updatedAt,
    attributeLabel: attribute.attributeClass.name,
    attributeValue: attribute.value,
    actionLabel: null,
    actionDescription: null,
    actionType: null,
    displaySurveyName: null,
  }));
  const unifiedDisplays: TActivityFeedItem[] = displays.map((display) => ({
    id: display.id,
    type: "display",
    createdAt: display.createdAt,
    updatedAt: display.updatedAt,
    attributeLabel: null,
    attributeValue: null,
    actionLabel: null,
    actionDescription: null,
    actionType: null,
    displaySurveyName: display.survey.name,
  }));
  const unifiedEvents: TActivityFeedItem[] = sessions.flatMap((session) =>
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
});
