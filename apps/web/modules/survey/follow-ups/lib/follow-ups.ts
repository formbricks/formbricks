import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { Result, err } from "@formbricks/types/error-handlers";
import { ValidationError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyFollowUp } from "@formbricks/types/surveys/follow-up";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { normalizeEmailForComparison } from "@/lib/utils/email";
import { validateInputs } from "@/lib/utils/validate";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationMemberEmails, resolveEmailActorUserId } from "@/modules/email/lib/email-actor";
import { sendFollowUpEmail } from "@/modules/survey/follow-ups/lib/email";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { FollowUpResult, FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";

const evaluateFollowUp = async (
  followUp: TSurveyFollowUp,
  survey: TSurvey,
  response: TResponse,
  organization: TOrganization,
  rateLimit: { organizationId: string; actorUserId: string | null },
  organizationMemberEmails: ReadonlySet<string>,
  locale?: TUserLocale
): Promise<FollowUpResult> => {
  try {
    const { properties } = followUp.action;
    const { to, replyTo } = properties;
    const toValueFromResponse = response.data[to];
    const logoUrl = organization.whitelabel?.logoUrl ?? "";

    // Check if 'to' is a direct email address (team member or user email)
    const parsedEmailTo = z.email().safeParse(to);
    if (parsedEmailTo.success) {
      // 'to' is a valid email address, send email directly
      await sendFollowUpEmail({
        followUp,
        to: parsedEmailTo.data,
        replyTo,
        survey,
        response,
        attachResponseData: properties.attachResponseData,
        includeVariables: properties.includeVariables,
        includeHiddenFields: properties.includeHiddenFields,
        logoUrl,
        locale,
        // The author can type any address, so only a member's counts as the organization's own mail.
        rateLimit: {
          ...rateLimit,
          externalRecipient: !organizationMemberEmails.has(normalizeEmailForComparison(parsedEmailTo.data)),
        },
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
      const parsedResult = z.email().safeParse(toValueFromResponse);
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
          includeVariables: properties.includeVariables,
          includeHiddenFields: properties.includeHiddenFields,
          locale,
          rateLimit: { ...rateLimit, externalRecipient: true },
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

      const parsedResult = z.email().safeParse(emailAddress);
      if (parsedResult.data) {
        await sendFollowUpEmail({
          followUp,
          to: parsedResult.data,
          replyTo,
          logoUrl,
          survey,
          response,
          attachResponseData: properties.attachResponseData,
          includeVariables: properties.includeVariables,
          includeHiddenFields: properties.includeHiddenFields,
          locale,
          rateLimit: { ...rateLimit, externalRecipient: true },
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
  responseId: string,
  locale?: TUserLocale
): Promise<
  Result<FollowUpResult[], { code: FollowUpSendError; message: string; meta?: Record<string, string> }>
> => {
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

    // Get organization from survey's workspaceId
    const organization = await getOrganizationByWorkspaceId(survey.workspaceId);
    if (!organization) {
      return err({
        code: FollowUpSendError.ORG_NOT_FOUND,
        message: "Organization not found",
        meta: { responseId, surveyId, workspaceId: survey.workspaceId },
      });
    }

    // Check if follow-ups are allowed for this organization
    const surveyFollowUpsPermission = await getSurveyFollowUpsPermission(organization.id);
    if (!surveyFollowUpsPermission) {
      return err({
        code: FollowUpSendError.FOLLOW_UP_NOT_ALLOWED,
        message: "Survey follow-ups are not allowed for this organization",
        meta: { responseId, surveyId, organizationId: organization.id },
      });
    }

    // Check rate limit
    try {
      await applyRateLimit(rateLimitConfigs.actions.surveyFollowUp, organization.id);
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

    // The only addresses this run classifies are the literal ones each follow-up names; the answer depends
    // on the address and the organization, so it is resolved once here instead of once per follow-up.
    const organizationMemberEmails = await getOrganizationMemberEmails(
      organization.id,
      survey.followUps.flatMap((followUp) => {
        const parsedTo = z.email().safeParse(followUp.action.properties.to);
        return parsedTo.success ? [parsedTo.data] : [];
      })
    );

    // The respondent is anonymous, so the survey's organization and owner carry the email limits. The owner,
    // not `createdBy`, which an API caller can set to anyone.
    const rateLimit = {
      organizationId: organization.id,
      actorUserId: await resolveEmailActorUserId(survey.ownerId, organization.id),
    };

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

      return evaluateFollowUp(
        followUp,
        survey,
        response,
        organization,
        rateLimit,
        organizationMemberEmails,
        locale
      );
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
