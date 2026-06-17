import "server-only";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemInternalError, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { serializeV3ContactAttributeKey } from "../serializers";

type TListV3ContactAttributeKeysParams = {
  workspaceId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

export async function listV3ContactAttributeKeys({
  workspaceId,
  authentication,
  requestId,
  instance,
}: TListV3ContactAttributeKeysParams): Promise<Response> {
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

    const attributeKeys = await getContactAttributeKeys(authResult.workspaceId);

    return successResponse(attributeKeys.map(serializeV3ContactAttributeKey), {
      requestId,
      cache: "private, no-store",
    });
  } catch (err) {
    if (err instanceof DatabaseError) {
      log.error({ err }, "Database error while listing contact attribute keys");
    } else {
      log.error({ err }, "Unexpected error while listing contact attribute keys");
    }
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}
