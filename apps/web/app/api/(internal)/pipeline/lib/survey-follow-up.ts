import { sendFollowUpEmail } from "@/modules/email";
import { z } from "zod";
import { TSurveyFollowUpAction } from "@formbricks/database/types/survey-follow-up";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

export const sendSurvyeFollowUps = async (survey: TSurvey, response: TResponse) => {
  const evaluateFollowUp = async (
    followUpId: string,
    followUpAction: TSurveyFollowUpAction
  ): Promise<void> => {
    try {
      const { properties } = followUpAction;
      const { to, subject, body, replyTo } = properties;

      const toValueFromResponse = response.data[to];

      if (!toValueFromResponse) {
        throw new Error(`"To" value not found in response data for followup: ${followUpId}`);
      }

      if (typeof toValueFromResponse === "string") {
        // parse this string to check for an email:

        const parsedResult = z.string().email().safeParse(toValueFromResponse);
        if (parsedResult.data) {
          // send email to this email address
          await sendFollowUpEmail(survey, body, subject, parsedResult.data, replyTo);
        } else {
          throw new Error(`Email address is not valid for followup: ${followUpId}`);
        }
      } else if (Array.isArray(toValueFromResponse)) {
        const emailAddress = toValueFromResponse[2];
        if (!emailAddress) {
          throw new Error(`Email address not found in response data for followup: ${followUpId}`);
        }

        const parsedResult = z.string().email().safeParse(emailAddress);
        if (parsedResult.data) {
          await sendFollowUpEmail(survey, body, subject, parsedResult.data, replyTo);
        } else {
          throw new Error(`Email address is not valid for followup: ${followUpId}`);
        }
      }
    } catch (error) {
      throw new Error(`Error occurred in evaluating the followup: ${followUpId}`);
    }
  };

  const followUpPromises = survey.followUps.map(async (followUp) => {
    try {
      await evaluateFollowUp(followUp.id, followUp.action);
      return {
        followUpId: followUp.id,
        status: "success" as const,
      };
    } catch (error) {
      return {
        followUpId: followUp.id,
        status: "error" as const,
        error: error.message ?? "Something went wrong",
      };
    }
  });

  const followUpResults = await Promise.allSettled(followUpPromises);

  // Log all errors together after processing
  const errors = followUpResults
    .map((result, index) => {
      if (result.status === "rejected") {
        return `FollowUp ${survey.followUps[index].id} failed: ${result.reason}`;
      }
      if (result.status === "fulfilled" && result.value.status === "error") {
        return `FollowUp ${result.value.followUpId} failed: ${result.value.error}`;
      }
      return null;
    })
    .filter(Boolean);

  if (errors.length > 0) {
    console.error("Follow-up processing errors:", errors);
  }
};
