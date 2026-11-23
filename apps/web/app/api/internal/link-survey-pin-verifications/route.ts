import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { verifyLinkSurveyPinOperation } from "./lib/operations";
import { ZLinkSurveyPinVerificationBody } from "./schemas";

/**
 * `POST /api/internal/link-survey-pin-verifications`: check the PIN a respondent typed and, when it matches,
 * hand out the survey. Unauthenticated: called from the public link-survey page, which the survey domain
 * (`PUBLIC_URL`) serves, so the domain router allows this path there (`app/middleware/route-config.ts`).
 */
export const POST = withV3ApiWrapper({
  auth: "none",
  schemas: { body: ZLinkSurveyPinVerificationBody },
  bodyLimitBytes: PRE_LOGIN_BODY_LIMIT_BYTES,
  handler: async ({ parsedInput, requestId, instance }) =>
    verifyLinkSurveyPinOperation({ body: parsedInput.body, requestId, instance }),
});
