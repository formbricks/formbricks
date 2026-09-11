import "server-only";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import {
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  RESPONSES_CURSOR_KIND,
  type TV3InvalidParam,
  parseV3ResponsesCountQuery,
  parseV3ResponsesListQuery,
} from "./parse-v3-responses-list-query";
import { createV3ResponseSerializer } from "./serializers";
import {
  countV3Responses,
  deleteScopedResponse,
  deleteScopedResponses,
  getResponseWorkspaceId,
  getScopedV3Response,
  getV3ResponseSurveys,
  hydrateV3Responses,
  listV3ResponseKeysetPage,
} from "./service";

type TDeleteParams = {
  responseId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * `DELETE /api/v3/responses/{responseId}` → 204.
 *
 * Returns a `Response` and never throws, because these operations have two callers: the HTTP wrapper,
 * and the MCP server, which calls them directly with no wrapper to catch anything.
 *
 * Permission is `manage`, not `write`. The shipped AuthZed schema assigns `write` to "web-session
 * mutations such as tagging or deleting" and `manage` to "delete through the legacy management APIs", so
 * the API deletes at `manage` — matching v1/v2 and the `deleteV3FeedbackRecord` precedent. The dashboard
 * keeps deleting at `write`; that divergence is deliberate until the Internal API RFC's Wave 3.
 */
export async function deleteV3Response({
  responseId,
  authentication,
  requestId,
  instance,
  auditLog,
}: TDeleteParams): Promise<Response> {
  const log = logger.withContext({ requestId, responseId });

  try {
    const workspaceId = await getResponseWorkspaceId(responseId);

    // A response that does not exist and one in another workspace answer identically. The default detail
    // is what `problemForbidden` and every pre-flight rejection use, so the bodies are byte-identical —
    // asserted as body equality in the tests, because two 403s differing by a word are still an oracle.
    if (!workspaceId) {
      return problemForbidden(requestId, undefined, instance);
    }

    const access = await requireV3WorkspaceAccess(authentication, workspaceId, "manage", requestId, instance);

    if (access instanceof Response) {
      return access;
    }

    const deleted = await deleteScopedResponse(responseId, { workspaceId });

    if (auditLog) {
      auditLog.targetId = responseId;
      auditLog.organizationId = access.organizationId;
      // The deleted content, kept only in the audit trail — the response itself is gone. v1, v2 and
      // `deleteV3FeedbackRecord` all record it; a delete that does not say *what* it destroyed is not
      // reviewable. `redactPII` runs over this before it is persisted.
      auditLog.oldObject = deleted;
    }

    return noContentResponse({ requestId });
  } catch (error) {
    // The service already turned P2025 into `ResourceNotFoundError`, which this renders as the same 403
    // as the pre-flight rejection above — so a response deleted between the scope lookup and the delete
    // is indistinguishable from one that was never the caller's.
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.delete",
    });
  }
}

type TBatchDeleteParams = {
  workspaceId: string;
  ids: string[];
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * `POST /api/v3/responses/batch-delete` → 200 `{ data: { deleted } }`.
 *
 * Unlike the single delete, the scope is supplied rather than derived — a batch has no one response to
 * resolve it from, and scope-filtering is only meaningful against a known workspace. That is safe here
 * because the value authorized against and the value filtered by are the same `workspaceId`: they
 * cannot diverge, so a foreign id matches nothing instead of being deleted under a scope the caller
 * does hold. Deriving it from the ids instead would mean authorizing every distinct workspace the batch
 * touches, which contradicts the contract's promise to ignore out-of-scope ids rather than refuse them.
 *
 * A shortfall is not an error: `deleted` is allowed to be lower than `ids.length`, or zero.
 */
export async function batchDeleteV3Responses({
  workspaceId,
  ids,
  authentication,
  requestId,
  instance,
  auditLog,
}: TBatchDeleteParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const access = await requireV3WorkspaceAccess(authentication, workspaceId, "manage", requestId, instance);

    if (access instanceof Response) {
      return access;
    }

    const { deleted, deletedIds } = await deleteScopedResponses(ids, { workspaceId });

    if (auditLog) {
      auditLog.organizationId = access.organizationId;
      // Identity only, deliberately. The single delete records the whole row because there is exactly
      // one; a batch of up to 100 would put an unbounded blob in a log line, and the ids are what makes
      // the action reviewable. `requested` is kept alongside `deleted` so a shortfall is legible after
      // the fact rather than looking like a partial failure.
      auditLog.oldObject = { workspaceId, requested: ids.length, deleted, responseIds: deletedIds };
    }

    log.info({ requested: ids.length, deleted }, "V3 responses batch deleted");

    return successResponse({ deleted }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.batchDelete",
    });
  }
}

type TReadParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

/**
 * Turn a parse failure into the 400 the contract promises.
 *
 * The parser reports every offending key at once, so a caller fixing a query sees all of it rather
 * than one problem per round trip.
 */
const badQuery = (invalidParams: TV3InvalidParam[], requestId: string, instance?: string): Response =>
  problemBadRequest(requestId, "The query parameters are invalid.", {
    invalid_params: invalidParams,
    instance,
  });

/**
 * `GET /api/v3/responses` → 200 `{ data, meta }`.
 *
 * Authorization comes before the cursor is even looked at: the scope is the caller's `workspaceId`,
 * checked against `read`, and everything below runs inside it. That ordering is what lets the cursor
 * carry no authority of its own — it is a position, re-authorized on every request.
 *
 * `meta` always carries all four keys. `totalCount` and `totalCountRelation` are `null` rather than
 * absent when the caller did not ask for a total, because the contract marks them required — a caller
 * can branch on the value without first checking the key exists.
 */
export async function listV3Responses({
  searchParams,
  authentication,
  requestId,
  instance,
}: TReadParams & { searchParams: URLSearchParams }): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const parsed = parseV3ResponsesListQuery(searchParams);
    if (!parsed.ok) {
      return badQuery(parsed.invalid_params, requestId, instance);
    }

    const access = await requireV3WorkspaceAccess(
      authentication,
      parsed.filter.workspaceId,
      "read",
      requestId,
      instance
    );

    if (access instanceof Response) {
      return access;
    }

    const keysetRows = await listV3ResponseKeysetPage({
      filter: parsed.filter,
      sortBy: parsed.sortBy,
      limit: parsed.limit,
      cursor: parsed.cursor,
    });

    const { page, nextCursor } = buildKeysetPage({
      rows: keysetRows,
      limit: parsed.limit,
      kind: RESPONSES_CURSOR_KIND,
      sortBy: parsed.sortBy,
      fp: parsed.fingerprint,
      sortValue: (row) => row.createdAt,
    });

    // Three independent queries, so all three go together: hydration, the surveys the page refers
    // to, and the total when it was asked for. The surveys are keyed off the keyset page rather
    // than the hydrated rows — phase one already carries `surveyId`, so waiting for the hydration
    // to learn which surveys to load would serialize two queries that need nothing from each other.
    const [rows, surveys, total] = await Promise.all([
      hydrateV3Responses(page.map((row) => row.id)),
      getV3ResponseSurveys(page.map((row) => row.surveyId)),
      parsed.includeTotalCount
        ? countV3Responses({ filter: parsed.filter, precision: "capped" })
        : Promise.resolve(null),
    ]);

    const serializer = createV3ResponseSerializer();

    // A response whose survey vanished between the two queries cannot be serialized against a
    // definition. Dropping it keeps the page valid rather than failing the whole read for one row;
    // it is logged because it should not happen outside a concurrent delete.
    const data = rows.flatMap((row) => {
      const survey = surveys.get(row.surveyId);
      if (!survey) {
        log.warn({ responseId: row.id, surveyId: row.surveyId }, "v3 list: survey missing for response");
        return [];
      }

      return [serializer.toListItem(row, survey)];
    });

    return successListResponse(
      data,
      {
        limit: parsed.limit,
        nextCursor,
        totalCount: total?.count ?? null,
        totalCountRelation: total?.relation ?? null,
      },
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.list",
    });
  }
}

/**
 * `GET /api/v3/responses/count` → 200 `{ data: { count, relation } }`.
 *
 * Exists so "how many match this filter" never requires fetching a page. `precision=exact` is the
 * documented slow path; the default stops counting at the cap and says so through `relation`.
 */
export async function countV3ResponsesOperation({
  searchParams,
  authentication,
  requestId,
  instance,
}: TReadParams & { searchParams: URLSearchParams }): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const parsed = parseV3ResponsesCountQuery(searchParams);
    if (!parsed.ok) {
      return badQuery(parsed.invalid_params, requestId, instance);
    }

    const access = await requireV3WorkspaceAccess(
      authentication,
      parsed.filter.workspaceId,
      "read",
      requestId,
      instance
    );

    if (access instanceof Response) {
      return access;
    }

    const { count, relation } = await countV3Responses({
      filter: parsed.filter,
      precision: parsed.precision,
    });

    return successResponse({ count, relation }, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.count",
    });
  }
}

/**
 * `GET /api/v3/responses/{responseId}` → 200 `{ data }`.
 *
 * The workspace is resolved from the response rather than supplied, so a caller cannot pair someone
 * else's response id with a workspace it happens to have access to. A response that does not exist
 * and one in another workspace answer with the same 403 and the same default detail — 404 would make
 * the id space probeable.
 */
export async function getV3Response({
  responseId,
  authentication,
  requestId,
  instance,
}: TReadParams & { responseId: string }): Promise<Response> {
  const log = logger.withContext({ requestId, responseId });

  try {
    const workspaceId = await getResponseWorkspaceId(responseId);

    if (!workspaceId) {
      return problemForbidden(requestId, undefined, instance);
    }

    const access = await requireV3WorkspaceAccess(authentication, workspaceId, "read", requestId, instance);

    if (access instanceof Response) {
      return access;
    }

    const row = await getScopedV3Response(responseId, { workspaceId });

    // Deleted between the scope lookup and the read. The same 403 as above, so the race is
    // indistinguishable from a response that was never the caller's.
    if (!row) {
      return problemForbidden(requestId, undefined, instance);
    }

    const surveys = await getV3ResponseSurveys([row.surveyId]);
    const survey = surveys.get(row.surveyId);

    if (!survey) {
      return problemForbidden(requestId, undefined, instance);
    }

    const resource = createV3ResponseSerializer().toResource(row, survey);

    return successResponse(resource, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.get",
    });
  }
}
