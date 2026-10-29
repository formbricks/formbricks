import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { assertV3ContactsEnabled } from "@/app/api/v3/lib/contacts-entitlement";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import { problemBadRequest, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { V3_CONTACT_SELECT, serializeV3Contact } from "../serializers";
import { buildV3ContactsCursorWhere, buildV3ContactsOrderBy, buildV3ContactsWhere } from "./contacts-where";
import {
  CONTACTS_CURSOR_KIND,
  type TV3InvalidParam,
  computeV3ContactsFingerprint,
  decodeV3ContactsCursor,
  parseV3ContactsListQuery,
  resolveV3ContactAttributeFilters,
} from "./parse-v3-contacts-list-query";

type TListV3ContactsParams = {
  searchParams: URLSearchParams;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

const badRequest = (
  log: ReturnType<typeof logger.withContext>,
  requestId: string,
  instance: string,
  invalidParams: TV3InvalidParam[]
): Response => {
  log.warn({ statusCode: 400, invalidParams }, "Validation failed");
  return problemBadRequest(requestId, "Invalid query parameters", {
    invalid_params: invalidParams,
    instance,
  });
};

export async function listV3Contacts({
  searchParams,
  authentication,
  requestId,
  instance,
}: TListV3ContactsParams): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const query = parseV3ContactsListQuery(searchParams);
    if (!query.ok) return badRequest(log, requestId, instance, query.invalid_params);

    const authResult = await requireV3WorkspaceAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) return authResult;

    const denied = await assertV3ContactsEnabled(authResult.organizationId, requestId, instance);
    if (denied) return denied;

    const { workspaceId } = authResult;

    // Only the keys the request names, and only inside the authorized workspace: a key from another
    // workspace answers exactly like an unknown one.
    const requestedKeys = [...new Set(query.attributeFilters.map((filter) => filter.key))];
    const attributeKeys =
      requestedKeys.length > 0
        ? await prisma.contactAttributeKey.findMany({
            where: { workspaceId, key: { in: requestedKeys } },
            select: { id: true, key: true, dataType: true },
          })
        : [];

    const resolved = resolveV3ContactAttributeFilters(query.attributeFilters, attributeKeys);
    if (!resolved.ok) return badRequest(log, requestId, instance, resolved.invalid_params);

    const filterInput = {
      workspaceId,
      search: query.search,
      createdAtGte: query.createdAtGte,
      createdAtLte: query.createdAtLte,
    };
    const fingerprint = computeV3ContactsFingerprint(filterInput, resolved.filters);
    const decoded = decodeV3ContactsCursor(query.cursor, query.sortBy, fingerprint);
    if (!decoded.ok) return badRequest(log, requestId, instance, decoded.invalid_params);

    const where = buildV3ContactsWhere({ ...filterInput, filters: resolved.filters });
    const pageWhere = decoded.cursor
      ? { AND: [where, buildV3ContactsCursorWhere(decoded.cursor, query.sortBy)] }
      : where;

    const [rows, totalCount] = await Promise.all([
      prisma.contact.findMany({
        where: pageWhere,
        orderBy: buildV3ContactsOrderBy(query.sortBy),
        take: query.limit + 1,
        select: V3_CONTACT_SELECT,
      }),
      // Same filter, no cursor and no skip: the total across all pages.
      query.includeTotalCount ? prisma.contact.count({ where }) : Promise.resolve(null),
    ]);

    const { page, nextCursor } = buildKeysetPage({
      rows,
      limit: query.limit,
      kind: CONTACTS_CURSOR_KIND,
      sortBy: query.sortBy,
      fp: fingerprint,
      sortValue: (row) => row.createdAt,
    });

    return successListResponse(
      page.map(serializeV3Contact),
      { limit: query.limit, nextCursor, totalCount },
      { requestId, cache: "private, no-store" }
    );
  } catch (err) {
    return mapV3ThrownError(err, { log, requestId, instance, operation: "contacts.list" });
  }
}
