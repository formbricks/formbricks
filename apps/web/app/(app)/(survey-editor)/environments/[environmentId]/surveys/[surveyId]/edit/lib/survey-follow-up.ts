import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import {
  TSurveyFollowUpAction,
  TSurveyFollowUpTrigger,
  ZSurveyFollowUpAction,
  ZSurveyFollowUpTrigger,
} from "@formbricks/database/types/survey-follow-up";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

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

    return surveyFollowUp;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Error creating survey follow-up: ${error.message}`);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
