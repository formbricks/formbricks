import { getOrganization } from "@/lib/organization/service";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { rateLimit } from "@/lib/utils/rate-limit";
import { validateInputs } from "@/lib/utils/validate";
import { sendFollowUpEmail } from "@/modules/email";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { FollowUpResult, FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { z } from "zod";
import { TSurveyFollowUpAction } from "@formbricks/database/types/survey-follow-up";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { Result, err } from "@formbricks/types/error-handlers";
import { TOrganization } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

const limiter = rateLimit({
  interval: 60 * 60, // 1 hour
  allowedPerInterval: 50, // max 50 calls per org per hour
});

export const evaluateFollowUp = async (
  followUpId: string,
  followUpAction: TSurveyFollowUpAction,
  survey: TSurvey,
  response: TResponse,
  organization: TOrganization
): Promise<FollowUpResult> => {
  const { properties } = followUpAction;
  const { to, subject, body, replyTo } = properties;
  const toValueFromResponse = response.data[to];
  const logoUrl = organization.whitelabel?.logoUrl || "";

  // Check if 'to' is a direct email address (team member or user email)
  const parsedEmailTo = z.string().email().safeParse(to);
  if (parsedEmailTo.success) {
    try {
      // 'to' is a valid email address, send email directly
      await sendFollowUpEmail({
        html: body,
        subject,
        to: parsedEmailTo.data,
        replyTo,
        survey,
        response,
        attachResponseData: properties.attachResponseData,
        logoUrl,
      });

      return {
        followUpId,
        status: "success" as const,
      };
    } catch (error) {
      return {
        followUpId,
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong",
      };
    }
  }

  // If not a direct email, check if it's a question ID or hidden field ID
  if (!toValueFromResponse) {
    // throw new Error(`"To" value not found in response data for followup: ${followUpId}`);
    return {
      followUpId,
      status: "error",
      error: `To value not found in response data for followup: ${followUpId}`,
    };
  }

  if (typeof toValueFromResponse === "string") {
    // parse this string to check for an email:
    const parsedResult = z.string().email().safeParse(toValueFromResponse);
    if (parsedResult.data) {
      // send email to this email address
      await sendFollowUpEmail({
        html: body,
        subject,
        to: parsedResult.data,
        replyTo,
        logoUrl,
        survey,
        response,
        attachResponseData: properties.attachResponseData,
      });

      return {
        followUpId,
        status: "success" as const,
      };
    } else {
      return {
        followUpId,
        status: "error",
        error: `Email address is not valid for followup: ${followUpId}`,
      };
    }
  } else if (Array.isArray(toValueFromResponse)) {
    const emailAddress = toValueFromResponse[2];
    if (!emailAddress) {
      return {
        followUpId,
        status: "error",
        error: `Email address not found in response data for followup: ${followUpId}`,
      };
    }

    const parsedResult = z.string().email().safeParse(emailAddress);
    if (parsedResult.data) {
      await sendFollowUpEmail({
        html: body,
        subject,
        to: parsedResult.data,
        replyTo,
        logoUrl,
        survey,
        response,
        attachResponseData: properties.attachResponseData,
      });

      return {
        followUpId,
        status: "success" as const,
      };
    } else {
      return {
        followUpId,
        status: "error",
        error: `Email address is not valid for followup: ${followUpId}`,
      };
    }
  }

  return {
    followUpId,
    status: "error",
    error: "Something went wrong",
  };
};

export const sendSurveyFollowUps = async (
  organizationId: string,
  surveyId: string,
  responseId: string
): Promise<Result<FollowUpResult[], { code: FollowUpSendError; message: string; meta?: any }>> => {
  try {
    await limiter(organizationId);
  } catch (e) {
    return err({
      code: FollowUpSendError.RATE_LIMIT_EXCEEDED,
      message: "Too many follow‐up requests; please wait a bit and try again.",
    });
  }

  validateInputs([surveyId, ZId], [responseId, ZId], [organizationId, ZId]);

  const organization = await getOrganization(organizationId);
  if (!organization) {
    return err({
      code: FollowUpSendError.ORG_NOT_FOUND,
      message: "Organization not found",
      meta: {
        organizationId,
        surveyId,
        responseId,
      },
    });
  }

  const surveyFollowUpsPermission = await getSurveyFollowUpsPermission(organization.billing.plan);

  if (!surveyFollowUpsPermission) {
    return err({
      code: FollowUpSendError.FOLLOW_UP_NOT_ALLOWED,
      message: "Survey follow-ups are not allowed for this organization",
      meta: {
        organizationId,
        surveyId,
        responseId,
      },
    });
  }

  const survey = await getSurvey(surveyId);
  if (!survey) {
    return err({
      code: FollowUpSendError.SURVEY_NOT_FOUND,
      message: "Survey not found",
      meta: {
        organizationId,
        surveyId,
        responseId,
      },
    });
  }

  const response = await getResponse(responseId);
  if (!response) {
    return err({
      code: FollowUpSendError.RESPONSE_NOT_FOUND,
      message: "Response not found",
      meta: {
        organizationId,
        surveyId,
        responseId,
      },
    });
  }

  if (response.surveyId !== surveyId) {
    return err({
      code: FollowUpSendError.RESPONSE_SURVEY_MISMATCH,
      message: "Response does not belong to the specified survey",
      meta: {
        organizationId,
        surveyId,
        responseId,
      },
    });
  }

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

    return evaluateFollowUp(followUp.id, followUp.action, survey, response, organization);
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
          organizationId,
          surveyId,
          responseId,
        },
      },
      "Follow-up processing errors"
    );
  }

  return {
    ok: true,
    data: followUpResults,
  };
};
