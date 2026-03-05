import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey, TSurveyCreateInput } from "@formbricks/types/surveys/types";
import {
  getOrganizationByEnvironmentId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { validateMediaAndPrepareBlocks } from "@/lib/survey/utils";
import { TriggerUpdate } from "@/modules/survey/editor/types/survey-trigger";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { selectSurvey } from "@/modules/survey/lib/survey";

export const createSurvey = async (
  environmentId: string,
  surveyBody: TSurveyCreateInput
): Promise<TSurvey> => {
  try {
    const { createdBy, ...restSurveyBody } = surveyBody;

    // empty languages array
    if (!restSurveyBody.languages?.length) {
      delete restSurveyBody.languages;
    }

    const actionClasses = await getActionClasses(environmentId);

    // @ts-expect-error
    let data: Omit<Prisma.SurveyCreateInput, "environment"> = {
      ...restSurveyBody,
      // TODO: Create with attributeFilters
      triggers: restSurveyBody.triggers
        ? handleTriggerUpdates(restSurveyBody.triggers, [], actionClasses)
        : undefined,
      attributeFilters: undefined,
    };

    if (createdBy) {
      data.creator = {
        connect: {
          id: createdBy,
        },
      };
    }

    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    // Survey follow-ups
    if (restSurveyBody.followUps?.length) {
      data.followUps = {
        create: restSurveyBody.followUps.map((followUp) => ({
          name: followUp.name,
          trigger: followUp.trigger,
          action: followUp.action,
        })),
      };
    } else {
      delete data.followUps;
    }

    // Validate and prepare blocks
    if (data.blocks && data.blocks.length > 0) {
      data.blocks = validateMediaAndPrepareBlocks(data.blocks);
    }

    const survey = await prisma.survey.create({
      data: {
        ...data,
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
      select: selectSurvey,
    });

    // if the survey created is an "app" survey, we also create a private segment for it.
    if (survey.type === "app") {
      const newSegment = await prisma.segment.create({
        data: {
          title: survey.id,
          filters: [],
          isPrivate: true,
          environment: {
            connect: {
              id: environmentId,
            },
          },
        },
      });

      await prisma.survey.update({
        where: {
          id: survey.id,
        },
        data: {
          segment: {
            connect: {
              id: newSegment.id,
            },
          },
        },
      });
    }

    // TODO: Fix this, this happens because the survey type "web" is no longer in the zod types but its required in the schema for migration
    // @ts-expect-error
    const transformedSurvey: TSurvey = {
      ...survey,
      ...(survey.segment && {
        segment: {
          ...survey.segment,
          surveys: survey.segment.surveys.map((survey) => survey.id),
        },
      }),
    };

    if (createdBy) {
      await subscribeOrganizationMembersToSurveyResponses(survey.id, createdBy, organization.id);
    }

    return transformedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error creating survey");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

const getTriggerIds = (triggers: unknown): string[] | null => {
  if (!triggers) return null;
  if (!Array.isArray(triggers)) {
    throw new InvalidInputError("Invalid trigger id");
  }

  return triggers.map((trigger) => {
    const actionClassId = (trigger as { actionClass?: { id?: unknown } })?.actionClass?.id;
    if (typeof actionClassId !== "string") {
      throw new InvalidInputError("Invalid trigger id");
    }
    return actionClassId;
  });
};

const checkTriggersValidity = (triggers: unknown, actionClasses: Array<{ id: string }>) => {
  const triggerIds = getTriggerIds(triggers);
  if (!triggerIds) return;

  // check if all the triggers are valid
  triggerIds.forEach((triggerId) => {
    if (!actionClasses.find((actionClass) => actionClass.id === triggerId)) {
      throw new InvalidInputError("Invalid trigger id");
    }
  });

  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new InvalidInputError("Duplicate trigger id");
  }
};

export const handleTriggerUpdates = (
  updatedTriggers: unknown,
  currentTriggers: unknown,
  actionClasses: Array<{ id: string }>
) => {
  const updatedTriggerIds = getTriggerIds(updatedTriggers);
  if (!updatedTriggerIds) return {};

  checkTriggersValidity(updatedTriggers, actionClasses);

  const currentTriggerIds = getTriggerIds(currentTriggers) ?? [];

  // added triggers are triggers that are not in the current triggers and are there in the new triggers
  const addedTriggerIds = updatedTriggerIds.filter((triggerId) => !currentTriggerIds.includes(triggerId));

  // deleted triggers are triggers that are not in the new triggers and are there in the current triggers
  const deletedTriggerIds = currentTriggerIds.filter((triggerId) => !updatedTriggerIds.includes(triggerId));

  // Construct the triggers update object
  const triggersUpdate: TriggerUpdate = {};

  if (addedTriggerIds.length > 0) {
    triggersUpdate.create = addedTriggerIds.map((triggerId) => ({
      actionClassId: triggerId,
    }));
  }

  if (deletedTriggerIds.length > 0) {
    // disconnect the public triggers from the survey
    triggersUpdate.deleteMany = {
      actionClassId: {
        in: deletedTriggerIds,
      },
    };
  }

  return triggersUpdate;
};
