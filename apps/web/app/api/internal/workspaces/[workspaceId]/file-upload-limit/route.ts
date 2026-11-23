import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZWorkspaceIdParams } from "../../schemas";
import { getFileUploadLimitOperation } from "./lib/operations";

/** `GET /api/internal/workspaces/{workspaceId}/file-upload-limit`: the survey editor's file size cap. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkspaceIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getFileUploadLimitOperation({
      authentication,
      workspaceId: parsedInput.params.workspaceId,
      requestId,
      instance,
    }),
});
