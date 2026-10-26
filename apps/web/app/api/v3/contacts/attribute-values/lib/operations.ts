import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { assertV3ContactsEnabled } from "@/app/api/v3/lib/contacts-entitlement";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemBadRequest, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import type { TV3ContactAttributeValuesQuery } from "./schemas";

type TListV3ContactAttributeValuesParams = {
  query: TV3ContactAttributeValuesQuery;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/** A LIKE pattern matching `value` anywhere, with its own wildcards escaped. */
const toContainsPattern = (value: string): string => `%${escapeLikePattern(value)}%`;

/**
 * The distinct-values query, bounded at the database.
 *
 * Raw SQL on purpose: Prisma's `distinct` on `findMany` de-duplicates in the client after reading every
 * matching row, which on a large workspace would pull the whole attribute into memory. `SELECT DISTINCT
 * … ORDER BY … LIMIT` lets PostgreSQL walk the `(attributeKeyId, value)` index in order and stop at the
 * limit. Number and date keys return the stored string `value`, which mirrors the typed column on write.
 */
export const buildAttributeValuesQuery = ({
  attributeKeyId,
  search,
  limit,
}: {
  attributeKeyId: string;
  search?: string;
  limit: number;
}): Prisma.Sql => {
  const searchCondition = search ? Prisma.sql`AND "value" ILIKE ${toContainsPattern(search)}` : Prisma.empty;

  return Prisma.sql`
    SELECT DISTINCT "value"
    FROM "ContactAttribute"
    WHERE "attributeKeyId" = ${attributeKeyId}
      AND "value" <> ''
      ${searchCondition}
    ORDER BY "value" ASC
    LIMIT ${limit}
  `;
};

export async function listV3ContactAttributeValues({
  query,
  authentication,
  requestId,
  instance,
}: TListV3ContactAttributeValuesParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: query.workspaceId });

  try {
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

    // Resolved inside the authorized workspace, so a key from another workspace answers exactly like an
    // unknown one — and the value query below can only ever read this workspace's rows.
    const attributeKey = await prisma.contactAttributeKey.findUnique({
      where: { key_workspaceId: { key: query.key, workspaceId: authResult.workspaceId } },
      select: { id: true },
    });
    if (!attributeKey) {
      const invalidParams = [{ name: "key", reason: `Unknown attribute key "${query.key}".` }];
      log.warn({ statusCode: 400, invalidParams }, "Validation failed");
      return problemBadRequest(requestId, "Invalid query parameters", {
        invalid_params: invalidParams,
        instance,
      });
    }

    const rows = await prisma.$queryRaw<{ value: string }[]>(
      buildAttributeValuesQuery({ attributeKeyId: attributeKey.id, search: query.search, limit: query.limit })
    );

    return successResponse(
      rows.map((row) => ({ value: row.value })),
      { requestId, cache: "private, no-store" }
    );
  } catch (err) {
    return mapV3ThrownError(err, { log, requestId, instance, operation: "contact-attribute-values.list" });
  }
}
