import { getContactAttributeKeyValuesOperation } from "@/app/api/internal/segments/lib/operations";
import { ZContactAttributeKeyValuesParams } from "@/app/api/internal/segments/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";

/**
 * `GET /api/internal/contact-attribute-keys/{contactAttributeKeyId}/values`: the first distinct values the
 * attribute has, for the segment editor. Licence-gated (advanced targeting).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactAttributeKeyValuesParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getContactAttributeKeyValuesOperation({
      authentication,
      contactAttributeKeyId: parsedInput.params.contactAttributeKeyId,
      requestId,
      instance,
    }),
});
