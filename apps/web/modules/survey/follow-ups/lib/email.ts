import { TResponse } from "@formbricks/types/responses";
import { TSurveyFollowUp } from "@formbricks/types/surveys/follow-up";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { sendEmail } from "@/modules/email";
import type { TEmailRateLimitContext } from "@/modules/email/lib/email-rate-limits";
import { buildSurveyResponseEmailHtml } from "@/modules/email/lib/survey-response-email";

export const sendFollowUpEmail = async ({
  followUp,
  to,
  replyTo,
  survey,
  response,
  attachResponseData = false,
  includeVariables = false,
  includeHiddenFields = false,
  logoUrl,
  locale,
  rateLimit,
}: {
  followUp: TSurveyFollowUp;
  to: string;
  replyTo: string[];
  attachResponseData: boolean;
  includeVariables?: boolean;
  includeHiddenFields?: boolean;
  survey: TSurvey;
  response: TResponse;
  logoUrl?: string;
  locale?: TUserLocale;
  rateLimit: TEmailRateLimitContext;
}): Promise<void> => {
  const {
    action: {
      properties: { subject, body },
    },
  } = followUp;

  const emailHtmlBody = await buildSurveyResponseEmailHtml({
    body,
    survey,
    response,
    attachResponseData,
    includeVariables,
    includeHiddenFields,
    logoUrl,
    locale,
  });

  await sendEmail({
    emailType: "survey_follow_up",
    to,
    replyTo: replyTo.join(", "),
    subject,
    html: emailHtmlBody,
    rateLimit,
  });
};
