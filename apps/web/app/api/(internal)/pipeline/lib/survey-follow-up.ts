import { sendFollowUpEmail } from "@/modules/email";
import { z } from "zod";
import { TSurveyFollowUpAction } from "@formbricks/database/types/survey-follow-up";
import { TOrganization } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

type FollowUpResult = {
  followUpId: string;
  status: "success" | "error" | "skipped";
  error?: string;
};

const evaluateFollowUp = async (
  followUpId: string,
  followUpAction: TSurveyFollowUpAction,
  response: TResponse,
  organization: TOrganization
): Promise<void> => {
  const { properties } = followUpAction;
  const { to, subject, body, replyTo } = properties;
  const toValueFromResponse = response.data[to];
  const logoUrl = organization.whitelabel?.logoUrl || "";
  if (!toValueFromResponse) {
    throw new Error(`"To" value not found in response data for followup: ${followUpId}`);
  }

  if (typeof toValueFromResponse === "string") {
    // parse this string to check for an email:
    const parsedResult = z.string().email().safeParse(toValueFromResponse);
    if (parsedResult.data) {
      // send email to this email address
      await sendFollowUpEmail(body, subject, parsedResult.data, replyTo, logoUrl);
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
      await sendFollowUpEmail(body, subject, parsedResult.data, replyTo, logoUrl);
    } else {
      throw new Error(`Email address is not valid for followup: ${followUpId}`);
    }
  }
};

export const sendSurveyFollowUps = async (
  survey: TSurvey,
  response: TResponse,
  organization: TOrganization
) => {
  const followUpPromises = survey.followUps.map(async (followUp): Promise<FollowUpResult> => {
    const { trigger } = followUp;

    // Check if we should skip this follow-up based on ending IDs
    if (trigger.properties) {
      const { endingIds } = trigger.properties;
      const { endingId } = response;

      if (!endingId || !endingIds.includes(endingId)) {
        return Promise.resolve({
          followUpId: followUp.id,
          status: "skipped",
        });
      }
    }

    return evaluateFollowUp(followUp.id, followUp.action, response, organization)
      .then(() => ({
        followUpId: followUp.id,
        status: "success" as const,
      }))
      .catch((error) => ({
        followUpId: followUp.id,
        status: "error" as const,
        error: error instanceof Error ? error.message : "Something went wrong",
      }));
  });

  const followUpResults = await Promise.all(followUpPromises);

  // Log all errors
  const errors = followUpResults
    .filter((result): result is FollowUpResult & { status: "error" } => result.status === "error")
    .map((result) => `FollowUp ${result.followUpId} failed: ${result.error}`);

  if (errors.length > 0) {
    console.error("Follow-up processing errors:", errors);
  }
};
