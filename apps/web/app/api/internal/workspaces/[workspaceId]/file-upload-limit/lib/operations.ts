import "server-only";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganization } from "@/lib/organization/service";

/** The largest file a file upload question may accept on a plan with more than one workspace (1 GB). */
export const PAID_PLAN_FILE_UPLOAD_MAX_MB = 1024;
/** The largest file on a single-workspace plan. */
export const FREE_PLAN_FILE_UPLOAD_MAX_MB = 10;

/** The cap the survey editor offers for a file upload question's size limit. */
export type TFileUploadLimitResource = { maxFileSizeMB: number };

/**
 * `GET /api/internal/workspaces/{workspaceId}/file-upload-limit`: the file size cap the survey editor
 * offers. Anyone who can read the workspace may ask: the answer is one number derived from the plan, never
 * the billing record, so members who may not see billing still get their plan's real cap.
 */
export async function getFileUploadLimitOperation({
  authentication,
  workspaceId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  workspaceId: string;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const access = await requireSessionWorkspaceAccess(
    authentication,
    workspaceId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  const organization = await getOrganization(access.organizationId);
  // Authorized for an organization that is gone by now: the same 403 as one the caller can't see.
  if (!organization) return problemForbidden(requestId, undefined, instance);

  const { workspaces } = organization.billing.limits;
  const hasPaidCapacity = workspaces === null || (typeof workspaces === "number" && workspaces > 1);
  const resource: TFileUploadLimitResource = {
    maxFileSizeMB: hasPaidCapacity ? PAID_PLAN_FILE_UPLOAD_MAX_MB : FREE_PLAN_FILE_UPLOAD_MAX_MB,
  };
  return successResponse(resource, { requestId });
}
