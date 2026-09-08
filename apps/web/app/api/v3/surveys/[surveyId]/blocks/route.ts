import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { editV3SurveyBlocksResponse } from "../../lib/operations";
import { ZV3EmptyQuery } from "../../schemas";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

// Body validation lives in the operation so the REST route and the MCP tool produce identical
// problems from one place (same reason as PATCH /api/v3/surveys/{surveyId}).
export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
    query: ZV3EmptyQuery,
    body: z.unknown(),
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) =>
    await editV3SurveyBlocksResponse({
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
      auditLog,
    }),
});
