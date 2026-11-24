import type { TWorkspaceBrandingPatchBody } from "@/app/api/internal/workspaces/[workspaceId]/branding/schemas";
import type { TWorkspaceBrandingResource } from "@/app/api/internal/workspaces/[workspaceId]/branding/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/** Show or hide the Formbricks badge on the workspace's link or in-app surveys. */
export const updateWorkspaceBranding = ({
  workspaceId,
  body,
}: {
  workspaceId: string;
  body: TWorkspaceBrandingPatchBody;
}) =>
  sendApiRequest<TWorkspaceBrandingResource>(
    `/api/internal/workspaces/${encodeURIComponent(workspaceId)}/branding`,
    { method: "PATCH", body }
  );
