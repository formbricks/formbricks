import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { assertV3ContactsEnabled } from "@/app/api/v3/lib/contacts-entitlement";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemBadRequest, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { serializeV3ContactAttributeKey } from "../serializers";
import { listContactAttributeKeysPage } from "./list";
import { parseV3ContactAttributeKeysListQuery } from "./parse-v3-contact-attribute-keys-list-query";

type TListV3ContactAttributeKeysParams = {
  searchParams: URLSearchParams;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

export async function listV3ContactAttributeKeys({
  searchParams,
  authentication,
  requestId,
  instance,
}: TListV3ContactAttributeKeysParams): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const query = parseV3ContactAttributeKeysListQuery(searchParams);
    if (!query.ok) {
      log.warn({ statusCode: 400, invalidParams: query.invalid_params }, "Validation failed");
      return problemBadRequest(requestId, "Invalid query parameters", {
        invalid_params: query.invalid_params,
        instance,
      });
    }

    const authResult = await requireV3WorkspaceAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) return authResult;

    // Contact attribute keys belong to the enterprise Contacts feature — gate the list the same way
    // the UI and management API do, so an unentitled organization can't enumerate them through v3.
    const denied = await assertV3ContactsEnabled(authResult.organizationId, requestId, instance);
    if (denied) return denied;

    const keys = await getContactAttributeKeys(authResult.workspaceId);
    const { page, nextCursor, totalCount } = listContactAttributeKeysPage(
      keys,
      authResult.workspaceId,
      query
    );

    return successListResponse(
      page.map(serializeV3ContactAttributeKey),
      { limit: query.limit, nextCursor, totalCount: query.includeTotalCount ? totalCount : null },
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
    return mapV3ThrownError(err, { log, requestId, instance, operation: "contact-attribute-keys.list" });
  }
}
