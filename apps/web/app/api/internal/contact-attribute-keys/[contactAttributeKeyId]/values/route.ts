import { getContactAttributeKeyValuesOperation } from "@/app/api/internal/segments/lib/operations";
import {
  ZContactAttributeKeyValuesParams,
  ZContactAttributeKeyValuesQuery,
} from "@/app/api/internal/segments/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";

/**
 * `GET /api/internal/contact-attribute-keys/{contactAttributeKeyId}/values?workspaceId=`: the first distinct
 * values the attribute has in the workspace's contact directory, for the segment editor. Licence-gated (advanced targeting).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactAttributeKeyValuesParams, query: ZContactAttributeKeyValuesQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getContactAttributeKeyValuesOperation({
      authentication,
      contactAttributeKeyId: parsedInput.params.contactAttributeKeyId,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});
