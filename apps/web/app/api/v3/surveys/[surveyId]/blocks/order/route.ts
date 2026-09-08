import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { setV3SurveyBlockOrderResponse } from "../../../lib/operations";
import { ZV3EmptyQuery } from "../../../schemas";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

// PUT, not PATCH: the body is the complete desired order, so the same request applied twice leaves
// the same state — and an order that already matches performs no write at all.
export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
    query: ZV3EmptyQuery,
    body: z.unknown(),
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) =>
    await setV3SurveyBlockOrderResponse({
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
      auditLog,
    }),
});
