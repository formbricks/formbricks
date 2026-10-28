import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { generateV3Survey } from "./operations";
import { ZV3SurveyGenerateBody } from "./schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyGenerate,
  schemas: {
    body: ZV3SurveyGenerateBody,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    generateV3Survey({ authentication, body: parsedInput.body, requestId, instance }),
});
