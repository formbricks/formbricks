import type { TApiAuditLog } from "@/app/lib/api/with-api-logging";
import { responses } from "@/modules/api/v2/lib/response";
import { logApiError } from "@/modules/api/v2/lib/utils";
import type { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import {
  CONTACT_DIRECTORY_MISSING_MESSAGE,
  type TWorkspaceContactDirectory,
  getWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";

/**
 * The workspace's contact directory for a v2 contact write, or the 403 that refuses the request when it
 * has none (spec decision 13). Call it after the permission check, so a caller without access cannot learn
 * whether the workspace has a directory. Unlike other v2 403s, the reply carries the message.
 */
export const getContactDirectoryOrForbidden = async (
  request: Request,
  workspaceId: string,
  auditLog: TApiAuditLog | undefined
): Promise<TWorkspaceContactDirectory | Response> => {
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (directory) return directory;

  const error = {
    type: "forbidden",
    details: [{ field: "workspaceId", issue: CONTACT_DIRECTORY_MISSING_MESSAGE }],
  } satisfies ApiErrorResponseV2;
  logApiError(request, error, auditLog);
  return responses.forbiddenResponse({ details: error.details });
};
