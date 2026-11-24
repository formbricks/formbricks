import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { addResponseTagOperation, removeResponseTagOperation } from "../../../lib/operations";
import { ZResponseTagParams } from "../../../schemas";

/** `PUT /api/internal/responses/{responseId}/tags/{tagId}`: put a workspace tag on the response. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZResponseTagParams },
  action: "addedToResponse",
  targetType: "tag",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    addResponseTagOperation({ authentication, ...parsedInput.params, requestId, instance, auditLog }),
});

/** `DELETE /api/internal/responses/{responseId}/tags/{tagId}`: take the tag off the response. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZResponseTagParams },
  action: "removedFromResponse",
  targetType: "tag",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    removeResponseTagOperation({ authentication, ...parsedInput.params, requestId, instance, auditLog }),
});
