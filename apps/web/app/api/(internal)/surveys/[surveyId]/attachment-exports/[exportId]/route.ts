import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemNotFound, successResponse } from "@/app/api/v3/lib/response";
import { getAttachmentExport, toAttachmentExportDto } from "@/modules/storage/attachment-export/service";
import { authorizeAttachmentExportAccess } from "../lib/authorize";

/** `GET /api/surveys/{surveyId}/attachment-exports/{exportId}`: one export's status, polled by the client. */

const paramsSchema = z.object({
  surveyId: z.cuid2(),
  exportId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: paramsSchema },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const access = await authorizeAttachmentExportAccess({
      surveyId: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
    });
    if (access.response) return access.response;

    // Scoped to the requester: someone else's export of the same survey is a 404, not a 403, so its
    // existence is not probeable.
    const row = await getAttachmentExport({
      id: parsedInput.params.exportId,
      surveyId: access.survey.id,
      workspaceId: access.workspaceId,
      requestedById: access.userId,
    });
    if (!row) return problemNotFound(requestId, "AttachmentExport", null, instance);

    return successResponse(toAttachmentExportDto(row), { requestId });
  },
});
