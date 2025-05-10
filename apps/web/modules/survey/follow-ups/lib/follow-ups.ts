import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { rateLimit } from "@/lib/utils/rate-limit";
import { validateInputs } from "@/lib/utils/validate";
import { sendFollowUpEmail } from "@/modules/survey/follow-ups/lib/email";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { FollowUpResult, FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { z } from "zod";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { Result, err } from "@formbricks/types/error-handlers";
import { ValidationError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

const limiter = rateLimit({
  interval: 60 * 60, // 1 hour
  allowedPerInterval: 50, // max 50 calls per org per hour
});

const evaluateFollowUp = async (
  followUp: TSurveyFollowUp,
  survey: TSurvey,
  response: TResponse,
  organization: TOrganization
): Promise<FollowUpResult> => {
  try {
    const { properties } = followUp.action;
    const { to, replyTo } = properties;
    const toValueFromResponse = response.data[to];
    const logoUrl = organization.whitelabel?.logoUrl ?? "";

    // Check if 'to' is a direct email address (team member or user email)
    const parsedEmailTo = z.string().email().safeParse(to);
    if (parsedEmailTo.success) {
      // 'to' is a valid email address, send email directly
      await sendFollowUpEmail({
        followUp,
        to: parsedEmailTo.data,
        replyTo,
        survey,
        response,
        attachResponseData: properties.attachResponseData,
        logoUrl,
      });

      return {
        followUpId: followUp.id,
        status: "success" as const,
      };
    }

    // If not a direct email, check if it's a question ID or hidden field ID
    if (!toValueFromResponse) {
      return {
        followUpId: followUp.id,
        status: "error",
        error: `To value not found in response data for followup: ${followUp.id}`,
      };
    }

    if (typeof toValueFromResponse === "string") {
      // parse this string to check for an email:
      const parsedResult = z.string().email().safeParse(toValueFromResponse);
      if (parsedResult.success) {
        // send email to this email address
        await sendFollowUpEmail({
          followUp,
          to: parsedResult.data,
          replyTo,
          logoUrl,
          survey,
          response,
          attachResponseData: properties.attachResponseData,
        });

        return {
          followUpId: followUp.id,
          status: "success" as const,
        };
      }

      return {
        followUpId: followUp.id,
        status: "error",
        error: `Email address is not valid for followup: ${followUp.id}`,
      };
    } else if (Array.isArray(toValueFromResponse)) {
      const emailAddress = toValueFromResponse[2];
      if (!emailAddress) {
        return {
          followUpId: followUp.id,
          status: "error",
          error: `Email address not found in response data for followup: ${followUp.id}`,
        };
      }

      const parsedResult = z.string().email().safeParse(emailAddress);
      if (parsedResult.data) {
        await sendFollowUpEmail({
          followUp,
          to: parsedResult.data,
          replyTo,
          logoUrl,
          survey,
          response,
          attachResponseData: properties.attachResponseData,
        });

        return {
          followUpId: followUp.id,
          status: "success" as const,
        };
      }

      return {
        followUpId: followUp.id,
        status: "error",
        error: `Email address is not valid for followup: ${followUp.id}`,
      };
    }

    return {
      followUpId: followUp.id,
      status: "error",
      error: "Something went wrong",
    };
  } catch (error) {
    return {
      followUpId: followUp.id,
      status: "error",
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
};

/**
 * Sends follow-up emails for a survey response.
 * This is the main entry point for sending follow-ups - it handles all the logic internally
 * and only requires a response ID.
 */
export const sendFollowUpsForResponse = async (
  responseId: string
): Promise<Result<FollowUpResult[], { code: FollowUpSendError; message: string; meta?: any }>> => {
  try {
    validateInputs([responseId, ZId]);
    // Get the response first to get the survey ID
    const response = await getResponse(responseId);
    if (!response) {
      return err({
        code: FollowUpSendError.RESPONSE_NOT_FOUND,
        message: "Response not found",
        meta: { responseId },
      });
    }

    const surveyId = response.surveyId;
    const survey = await getSurvey(surveyId);
    if (!survey) {
      return err({
        code: FollowUpSendError.SURVEY_NOT_FOUND,
        message: "Survey not found",
        meta: { responseId, surveyId },
      });
    }

    // Get organization from survey's environmentId
    const organization = await getOrganizationByEnvironmentId(survey.environmentId);
    if (!organization) {
      return err({
        code: FollowUpSendError.ORG_NOT_FOUND,
        message: "Organization not found",
        meta: { responseId, surveyId, environmentId: survey.environmentId },
      });
    }

    // Check if follow-ups are allowed for this organization
    const surveyFollowUpsPermission = await getSurveyFollowUpsPermission(organization.billing.plan);
    if (!surveyFollowUpsPermission) {
      return err({
        code: FollowUpSendError.FOLLOW_UP_NOT_ALLOWED,
        message: "Survey follow-ups are not allowed for this organization",
        meta: { responseId, surveyId, organizationId: organization.id },
      });
    }

    // Check rate limit
    try {
      await limiter(organization.id);
    } catch {
      return err({
        code: FollowUpSendError.RATE_LIMIT_EXCEEDED,
        message: "Too many follow‐up requests; please wait a bit and try again.",
      });
    }

    // If no follow-ups configured, return empty array
    if (!survey.followUps?.length) {
      return {
        ok: true,
        data: [],
      };
    }

    // Process each follow-up
    const followUpPromises = survey.followUps.map(async (followUp): Promise<FollowUpResult> => {
      const { trigger } = followUp;

      // Check if we should skip this follow-up based on ending IDs
      if (trigger.properties) {
        const { endingIds } = trigger.properties;
        const { endingId } = response;

        if (!endingId || !endingIds.includes(endingId)) {
          return {
            followUpId: followUp.id,
            status: "skipped",
          };
        }
      }

      return evaluateFollowUp(followUp, survey, response, organization);
    });

    const followUpResults = await Promise.all(followUpPromises);

    // Log all errors
    const errors = followUpResults
      .filter((result): result is FollowUpResult & { status: "error" } => result.status === "error")
      .map((result) => `FollowUp ${result.followUpId} failed: ${result.error}`);

    if (errors.length > 0) {
      logger.error(
        {
          errors,
          meta: {
            responseId,
            surveyId,
            organizationId: organization.id,
          },
        },
        "Follow-up processing errors"
      );
    }

    return {
      ok: true,
      data: followUpResults,
    };
  } catch (error) {
    logger.error(
      {
        error,
        meta: { responseId },
      },
      "Unexpected error while sending follow-ups"
    );

    if (error instanceof ValidationError) {
      return err({
        code: FollowUpSendError.VALIDATION_ERROR,
        message: error.message,
        meta: { responseId },
      });
    }

    return err({
      code: FollowUpSendError.UNEXPECTED_ERROR,
      message: "An unexpected error occurred while sending follow-ups",
      meta: { responseId },
    });
  }
};
