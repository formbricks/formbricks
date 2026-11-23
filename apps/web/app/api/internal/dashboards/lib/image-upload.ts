import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { StorageErrorCode } from "@formbricks/storage";
import { authorizeLoadedDashboard } from "@/app/api/v3/dashboards/lib/access";
import type { TV3DashboardOperationContext } from "@/app/api/v3/dashboards/lib/access";
import { getDashboardWorkspaceRow } from "@/app/api/v3/dashboards/lib/service";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemBadRequest, problemInternalError, successResponse } from "@/app/api/v3/lib/response";
import { getSignedUrlForUpload } from "@/modules/storage/service";

/** The image types an image block takes: what browsers draw in an `<img>`. */
export const DASHBOARD_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp", "gif"] as const;

/** The largest image a block may upload. */
export const MAX_DASHBOARD_IMAGE_BYTES = 5 * 1024 * 1024;

export const ZDashboardImageUploadParams = z.object({ dashboardId: z.cuid2() }).strict();

/** `POST /api/internal/dashboards/{dashboardId}/image-uploads`: the file to upload, by name. */
export const ZDashboardImageUploadBody = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(
        (name) =>
          (DASHBOARD_IMAGE_EXTENSIONS as readonly string[]).includes(
            name.split(".").pop()?.toLowerCase() ?? ""
          ),
        { message: `Upload a ${DASHBOARD_IMAGE_EXTENSIONS.join(", ")} image.` }
      ),
  })
  .strict();
export type TDashboardImageUploadBody = z.infer<typeof ZDashboardImageUploadBody>;

/**
 * A presigned upload for an image block (ENG-7249): a **private** file of the dashboard's workspace, under
 * `dashboards/<dashboardId>/`, so only people who can read the workspace — and, once the storage route
 * learns it (ENG-7482), Dashboard Viewers of the page the block sits on — can download it. Needs write
 * access to the dashboard. The answer's `fileUrl` is what the block's `content.fileUrl` then holds.
 */
export async function createDashboardImageUpload({
  dashboardId,
  body,
  ...context
}: TV3DashboardOperationContext & {
  dashboardId: string;
  body: TDashboardImageUploadBody;
}): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardWorkspaceRow(dashboardId),
      "readWrite",
      context
    );
    if (loaded instanceof Response) return loaded;

    const signed = await getSignedUrlForUpload(
      body.fileName,
      loaded.access.workspaceId,
      "private",
      MAX_DASHBOARD_IMAGE_BYTES,
      ["dashboards", dashboardId]
    );
    if (!signed.ok) {
      if (signed.error.code === StorageErrorCode.InvalidInput) {
        return problemBadRequest(requestId, "The file name cannot be uploaded", {
          instance,
          invalid_params: [{ name: "fileName", reason: "Use a plain file name with an image extension." }],
        });
      }
      log.error({ error: signed.error }, "Could not presign a dashboard image upload");
      return problemInternalError(requestId, "The upload could not be prepared.", instance);
    }

    return successResponse(signed.data, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.images.upload" });
  }
}
