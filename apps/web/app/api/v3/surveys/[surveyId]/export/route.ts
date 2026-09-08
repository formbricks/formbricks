/**
 * GET /api/v3/surveys/{surveyId}/export — portable export envelope (`.formbricks.json`) for one survey.
 * Session cookie or x-api-key; read access on the survey's workspace. Audit-logged as `exported`.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "../../schemas";
import { exportV3Survey } from "./lib/export-survey";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "both",
  action: "exported",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
    // Single-survey endpoints locate the survey by its globally-unique id; reject stray query params.
    query: ZV3EmptyQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    return await exportV3Survey({
      surveyId: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});
