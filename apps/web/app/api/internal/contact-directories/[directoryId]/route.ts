import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getContactDirectoryOperation, updateContactDirectoryOperation } from "../lib/operations";
import { ZContactDirectoryParams, ZContactDirectoryQuery, ZContactDirectoryUpdateBody } from "../schemas";

/** `GET /api/internal/contact-directories/{directoryId}`: one directory. Internal; owners and managers only. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactDirectoryParams, query: ZContactDirectoryQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getContactDirectoryOperation({
      authentication,
      directoryId: parsedInput.params.directoryId,
      requestId,
      instance,
    }),
});

/**
 * `PATCH /api/internal/contact-directories/{directoryId}`: rename a directory or add workspaces to it.
 * The matching key never changes (spec decision 1), and no workspace may leave (decision 8).
 */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: {
    params: ZContactDirectoryParams,
    query: ZContactDirectoryQuery,
    body: ZContactDirectoryUpdateBody,
  },
  action: "updated",
  targetType: "contactDirectory",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateContactDirectoryOperation({
      authentication,
      directoryId: parsedInput.params.directoryId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
