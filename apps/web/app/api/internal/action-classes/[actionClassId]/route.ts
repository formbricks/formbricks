import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteActionClassOperation, updateActionClassOperation } from "../lib/operations";
import { ZActionClassParams, ZActionClassPatchBody } from "../schemas";

/** `PATCH /api/internal/action-classes/{actionClassId}`: change an action. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZActionClassParams, body: ZActionClassPatchBody },
  action: "updated",
  targetType: "actionClass",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateActionClassOperation({
      authentication,
      actionClassId: parsedInput.params.actionClassId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/action-classes/{actionClassId}`: delete an action. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZActionClassParams },
  action: "deleted",
  targetType: "actionClass",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteActionClassOperation({
      authentication,
      actionClassId: parsedInput.params.actionClassId,
      requestId,
      instance,
      auditLog,
    }),
});
