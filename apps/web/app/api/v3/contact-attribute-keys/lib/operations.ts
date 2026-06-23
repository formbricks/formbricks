import "server-only";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { paginateByIdCursor } from "@/app/api/v3/lib/cursor-pagination";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successListResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { serializeV3ContactAttributeKey } from "../serializers";

type TListV3ContactAttributeKeysParams = {
  workspaceId: string;
  limit: number;
  cursor?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

export async function listV3ContactAttributeKeys({
  workspaceId,
  limit,
  cursor,
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

    // Contact attribute keys belong to the enterprise Contacts feature. Gate the list the same way
    // the UI and management API do, so an organization without the entitlement can't enumerate them
    // through v3.
    const organization = await getOrganizationByWorkspaceId(authResult.workspaceId);
    if (!organization || !(await getIsContactsEnabled(organization.id))) {
      return problemForbidden(
        requestId,
        "The contacts feature is not enabled for this organization.",
        instance
      );
    }

    // getContactAttributeKeys returns the workspace's full key list (request-deduped via React
    // cache), so we paginate in memory here instead of at the DB — a bounded reference collection
    // (see paginateByIdCursor).
    const attributeKeys = await getContactAttributeKeys(authResult.workspaceId);
    const { page, nextCursor } = paginateByIdCursor(attributeKeys, { limit, cursor });

    return successListResponse(
      page.map(serializeV3ContactAttributeKey),
      { limit, nextCursor },
      { requestId, cache: "private, no-store" }
    );
  } catch (err) {
    if (err instanceof InvalidInputError) {
      log.warn({ statusCode: 400 }, "Invalid pagination cursor");
      return problemBadRequest(requestId, err.message, {
        invalid_params: [{ name: "cursor", reason: err.message }],
        instance,
      });
    }
    if (err instanceof DatabaseError) {
      log.error({ err }, "Database error while listing contact attribute keys");
    } else {
      log.error({ err }, "Unexpected error while listing contact attribute keys");
    }
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}
