import { ResourceNotFoundError } from "@formbricks/types/errors";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { getResponseIdByDisplayId } from "./lib/response";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = withV1ApiWrapper({
  handler: async ({
    props,
  }: THandlerParams<{ params: Promise<{ workspaceId: string; displayId: string }> }>) => {
    const params = await props.params;

    const resolved = await resolveClientApiIds(params.workspaceId);
    if (!resolved) {
      return {
        response: responses.notFoundResponse("Workspace", params.workspaceId, true),
      };
    }
    const { workspaceId } = resolved;

    try {
      const response = await getResponseIdByDisplayId(workspaceId, params.displayId);

      return {
        response: responses.successResponse(response, true),
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        return {
          response: responses.notFoundResponse("Display", params.displayId, true),
        };
      }
      return handleApiError(error, { cors: true });
    }
  },
});
