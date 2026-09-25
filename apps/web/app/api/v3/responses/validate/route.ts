import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { ZV3ResponseValidationRequestBody } from "../lib/schemas";
import { validateV3Response } from "../lib/validate-operations";

/**
 * `POST /api/v3/responses/validate`.
 *
 * No `auditLog`: this endpoint writes nothing, so there is nothing to record. Mirrors
 * `app/api/v3/surveys/validate/route.ts`, down to the dual auth.
 */
export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: ZV3ResponseValidationRequestBody,
    query: ZV3EmptyQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    return await validateV3Response({
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
    });
  },
});
