import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { changeV3SurveyVisibility, getV3SurveyVisibility } from "../../visibility/operations";

const surveyParamsSchema = z.object({ surveyId: z.cuid2() });

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: surveyParamsSchema, query: ZV3EmptyQuery },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    getV3SurveyVisibility({ authentication, instance, requestId, surveyId: parsedInput.params.surveyId }),
});

// The body's shape is checked by the operation rather than here: it owns the 400's
// `unsupported_field` codes, and the MCP surface calls it without this wrapper.
export const POST = withV3ApiWrapper({
  auth: "both",
  action: "visibilityChanged",
  targetType: "survey",
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyVisibility,
  schemas: { params: surveyParamsSchema, query: ZV3EmptyQuery, body: z.unknown() },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    changeV3SurveyVisibility({
      auditLog,
      authentication,
      body: parsedInput.body,
      instance,
      requestId,
      surveyId: parsedInput.params.surveyId,
    }),
});
