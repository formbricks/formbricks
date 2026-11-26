import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { sendLinkSurveyVerificationEmailOperation } from "./lib/operations";
import { ZLinkSurveyVerificationEmailBody } from "./schemas";

/**
 * `POST /api/internal/link-survey-verification-emails`: email a respondent the verified link to a survey that
 * asks for email verification. Unauthenticated: called from the public link-survey page, which the survey
 * domain (`PUBLIC_URL`) serves, so the domain router allows this path there (`app/middleware/route-config.ts`).
 */
export const POST = withV3ApiWrapper({
  auth: "none",
  schemas: { body: ZLinkSurveyVerificationEmailBody },
  bodyLimitBytes: PRE_LOGIN_BODY_LIMIT_BYTES,
  handler: async ({ parsedInput, requestId, instance }) =>
    sendLinkSurveyVerificationEmailOperation({ body: parsedInput.body, requestId, instance }),
});
