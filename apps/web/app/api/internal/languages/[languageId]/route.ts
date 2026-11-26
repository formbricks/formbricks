import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteLanguageOperation, updateLanguageOperation } from "../lib/operations";
import { ZLanguageIdParams, ZLanguageUpdateBody } from "../schemas";

/** `PATCH /api/internal/languages/{languageId}`: change a language's alias. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZLanguageIdParams, body: ZLanguageUpdateBody },
  action: "updated",
  targetType: "language",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateLanguageOperation({
      authentication,
      languageId: parsedInput.params.languageId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/languages/{languageId}`: remove a language no survey or creative uses. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZLanguageIdParams },
  action: "deleted",
  targetType: "language",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteLanguageOperation({
      authentication,
      languageId: parsedInput.params.languageId,
      requestId,
      instance,
      auditLog,
    }),
});
