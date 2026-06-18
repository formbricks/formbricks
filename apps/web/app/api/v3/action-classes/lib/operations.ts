import "server-only";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { paginateByIdCursor } from "@/app/api/v3/lib/cursor-pagination";
import { problemInternalError, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getActionClasses } from "@/lib/actionClass/service";
import { serializeV3ActionClass } from "../serializers";

type TListV3ActionClassesParams = {
  workspaceId: string;
  limit: number;
  cursor?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

export async function listV3ActionClasses({
  workspaceId,
  limit,
  cursor,
  authentication,
  requestId,
  instance,
}: TListV3ActionClassesParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const authResult = await requireV3WorkspaceAccess(
      authentication,
      workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return authResult;
    }

    const actionClasses = await getActionClasses(authResult.workspaceId);
    const { page, nextCursor } = paginateByIdCursor(actionClasses, { limit, cursor });

    return successListResponse(
      page.map(serializeV3ActionClass),
      { limit, nextCursor },
      { requestId, cache: "private, no-store" }
    );
  } catch (err) {
    if (err instanceof DatabaseError) {
      log.error({ err }, "Database error while listing action classes");
    } else {
      log.error({ err }, "Unexpected error while listing action classes");
    }
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}
