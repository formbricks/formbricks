import { surveyFollowUpCache } from "@/lib/cache/survey-follow-up";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import {
  TSurveyFollowUpAction,
  TSurveyFollowUpTrigger,
  ZSurveyFollowUpAction,
  ZSurveyFollowUpTrigger,
} from "@formbricks/database/types/survey-follow-up";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { cache } from "@formbricks/lib/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";

export const createSurveyFollowUp = async (
  surveyId: string,
  followUpData: {
    name: string;
    trigger: TSurveyFollowUpTrigger;
    action: TSurveyFollowUpAction;
  }
) => {
  validateInputs(
    [surveyId, ZId],
    [followUpData.name, ZString],
    [followUpData.trigger, ZSurveyFollowUpTrigger],
    [followUpData.action, ZSurveyFollowUpAction]
  );

  let surveyFollowUpTriggerProperties: TSurveyFollowUpTrigger["properties"] = null;

  if (followUpData.trigger.type === "endings") {
    surveyFollowUpTriggerProperties = followUpData.trigger.properties;
  }

  try {
    const surveyFollowUp = await prisma.surveyFollowUp.create({
      data: {
        name: followUpData.name,
        trigger: {
          type: followUpData.trigger.type,
          properties: surveyFollowUpTriggerProperties,
        },
        action: {
          type: "send-email",
          properties: followUpData.action.properties,
        },
        surveyId,
      },
    });

    surveyCache.revalidate({
      id: surveyId,
    });

    surveyFollowUpCache.revalidate({
      surveyId: surveyFollowUp.surveyId,
    });

    return surveyFollowUp;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Error creating survey follow-up: ${error.message}`);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getSurveyFollowUps = reactCache(
  (surveyId: string): Promise<TSurveyFollowUp[]> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId]);

        try {
          const surveyFollowUps = await prisma.surveyFollowUp.findMany({
            where: { surveyId },
          });

          return surveyFollowUps;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(`Error getting survey follow-ups: ${error.message}`);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getSurveyFollowUps-${surveyId}`],
      {
        tags: [surveyFollowUpCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const updateSurveyFollowUp = async (
  surveyFollowUpId: string,
  followUpData: Partial<{
    name: string;
    trigger: TSurveyFollowUpTrigger;
    action: TSurveyFollowUpAction;
  }>
) => {
  validateInputs(
    [surveyFollowUpId, ZId],
    [followUpData.name, ZString.optional()],
    [followUpData.trigger, ZSurveyFollowUpTrigger.optional()],
    [followUpData.action, ZSurveyFollowUpAction.optional()]
  );

  let surveyFollowUpTriggerProperties: TSurveyFollowUpTrigger["properties"] = null;

  if (followUpData?.trigger?.type === "endings") {
    surveyFollowUpTriggerProperties = followUpData.trigger.properties;

    if (!surveyFollowUpTriggerProperties) {
      throw new ValidationError("Trigger properties are required for endings trigger type");
    }
  }

  try {
    const surveyFollowUp = await prisma.surveyFollowUp.update({
      where: { id: surveyFollowUpId },
      data: {
        ...(followUpData.name ? { name: followUpData.name } : {}),
        ...(followUpData.trigger
          ? {
              trigger: {
                type: followUpData.trigger.type,
                properties: surveyFollowUpTriggerProperties,
              },
            }
          : {}),
        ...(followUpData.action
          ? {
              action: {
                type: "send-email",
                properties: followUpData.action.properties,
              },
            }
          : {}),
      },
    });

    surveyCache.revalidate({
      id: surveyFollowUp.surveyId,
    });

    surveyFollowUpCache.revalidate({
      surveyId: surveyFollowUp.surveyId,
    });

    return surveyFollowUp;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Error creating survey follow-up: ${error.message}`);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteSurveyFollowUp = async (surveyFollowUpId: string) => {
  validateInputs([surveyFollowUpId, ZId]);

  try {
    const surveyFollowUp = await prisma.surveyFollowUp.findUnique({
      where: { id: surveyFollowUpId },
    });

    if (!surveyFollowUp) {
      throw new ResourceNotFoundError("Survey follow-up", surveyFollowUpId);
    }

    await prisma.surveyFollowUp.delete({
      where: { id: surveyFollowUpId },
    });

    surveyCache.revalidate({
      id: surveyFollowUp.surveyId,
    });

    surveyFollowUpCache.revalidate({
      surveyId: surveyFollowUp.surveyId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Error deleting survey follow-up: ${error.message}`);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
