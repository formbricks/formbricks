import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { validateV3Survey } from "../lib/operations";
import { ZV3SurveyValidationRequestBody } from "../schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: ZV3SurveyValidationRequestBody,
    query: ZV3EmptyQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    return await validateV3Survey({
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
    });
  },
});
