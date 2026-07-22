import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { archiveV3Survey } from "../../lib/operations";
import { ZV3EmptyQuery } from "../../schemas";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "archived",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
    // Single-survey endpoints locate the survey by its globally-unique id; reject stray query params.
    query: ZV3EmptyQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    return await archiveV3Survey({
      surveyId: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});
