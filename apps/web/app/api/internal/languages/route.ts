import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createLanguageOperation } from "./lib/operations";
import { ZLanguageCreateBody, ZLanguageWorkspaceQuery } from "./schemas";

/** `POST /api/internal/languages?workspaceId=`: add a language to the workspace. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZLanguageWorkspaceQuery, body: ZLanguageCreateBody },
  action: "created",
  targetType: "language",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createLanguageOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
