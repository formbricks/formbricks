import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { CompleteSurveyFollowUp, _SurveyFollowUpModel } from "@formbricks/database/zod/surveyfollowup";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const createSurveyFollowUp = async (
  surveyId: string,
  followUpData: {
    name: string;
    trigger: CompleteSurveyFollowUp["trigger"];
    action: CompleteSurveyFollowUp["action"];
  }
) => {
  validateInputs(
    [surveyId, ZId],
    [followUpData.name, ZString],
    [followUpData.trigger, _SurveyFollowUpModel.pick({ trigger: true })],
    [followUpData.action, _SurveyFollowUpModel.pick({ action: true })]
  );

  let surveyFollowUpTriggerProperties: CompleteSurveyFollowUp["trigger"]["properties"] = null;

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
