import "server-only";
import { logger } from "@formbricks/logger";
import { getV3SessionUserId } from "@/app/api/v3/lib/auth";
import { capCustomCssIssues, customCssErrorsToInvalidParams } from "@/app/api/v3/lib/custom-css";
import { getV3CustomCssPrincipal } from "@/app/api/v3/lib/custom-css-rate-limit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  type InvalidParam,
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemCustomCssInvalid,
  problemCustomCssPlanRequired,
  problemForbidden,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { CustomCssInvalidError, CustomCssPlanRequiredError } from "@/modules/custom-css/lib/service";
import { authorizeCreative, authorizeCreativeWorkspace } from "@/modules/ee/creatives/lib/authorization";
import type { TCreativeState } from "@/modules/ee/creatives/lib/creative";
import { assertCreativeCustomCssWrite } from "@/modules/ee/creatives/lib/custom-css-write";
import { toCreativeState } from "@/modules/ee/creatives/lib/record";
import {
  type TCreativeRecord,
  findCreativeRecord,
  findCreativeRecordsPage,
} from "@/modules/ee/creatives/lib/repository";
import {
  CreativeReferenceError,
  archiveCreative,
  createCreative,
  deleteCreative,
  duplicateCreative,
  restoreCreative,
  updateCreative,
} from "@/modules/ee/creatives/lib/service";
import { MAX_STATS_PAGES, buildCreativeStats, resolveStatsRange } from "@/modules/ee/creatives/lib/stats";
import {
  findCreativeDayDeviceCounts,
  findCreativePageCounts,
} from "@/modules/ee/creatives/lib/stats-repository";
import {
  applyCreativePatch,
  buildCreativeCreateState,
  validateCreativeState,
} from "@/modules/ee/creatives/lib/write-rules";
import { parseV3CreativesListQuery } from "./list-query";
import type { TV3CreateCreativeBody, TV3CreativeStatsQuery, TV3PatchCreativeBody } from "./schemas";
import { type TV3CreativeResource, serializeV3Creative } from "./serializers";

/**
 * The v3 creative operations (ENG-3993): the layer the `/api/v3/creatives` routes and the creative MCP
 * tools both call. Each takes parsed input and the caller's authentication and returns a `Response`
 * (success, or RFC 9457 problem), so an MCP tool is a thin adapter over the same behaviour.
 *
 * Access goes through `authorizeCreative` / `authorizeCreativeWorkspace` only. Writes validate the
 * whole resulting state with `validateCreativeState` (422 on a semantic problem) before the service
 * checks the references only the database can answer, inside the write's transaction.
 */

type TOperationContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

type TCreativeOperationParams = TOperationContext & { creativeId: string };

/** Where a creative's own Custom CSS sits in the body; processor errors are named after it. */
const CUSTOM_CSS_FIELD = "styling.theme.customCss";

/**
 * The plan gate and the processor for the creative's own CSS (ENG-3998), before anything is written.
 * Throws what `mapWriteError` turns into the 403 or 422.
 */
const assertCustomCssWrite = (
  previous: TCreativeState | null,
  next: TCreativeState,
  organizationId: string,
  authentication: TV3Authentication
): Promise<void> =>
  assertCreativeCustomCssWrite({
    type: next.type,
    previous: previous?.styling.theme.customCss,
    next: next.styling.theme.customCss,
    organizationId,
    principal: getV3CustomCssPrincipal(authentication),
  });

const creativeLocation = (creativeId: string): string => `/api/v3/creatives/${creativeId}`;

const problemInvalidCreative = (
  requestId: string,
  instance: string,
  invalidParams: InvalidParam[]
): Response =>
  problemUnprocessableContent(requestId, "The creative failed validation", {
    invalid_params: invalidParams,
    instance,
  });

const problemCreativeArchived = (requestId: string, instance: string): Response =>
  problemInvalidCreative(requestId, instance, [
    { name: "archivedAt", reason: "This creative is archived. Restore it before editing." },
  ]);

const recordAudit = (
  auditLog: TV3AuditLog | undefined,
  organizationId: string,
  targetId: string,
  objects: { oldObject?: TV3CreativeResource; newObject?: TV3CreativeResource }
): void => {
  if (!auditLog) return;
  auditLog.organizationId = organizationId;
  auditLog.targetId = targetId;
  if (objects.oldObject !== undefined) auditLog.oldObject = objects.oldObject;
  if (objects.newObject !== undefined) auditLog.newObject = objects.newObject;
};

const mapWriteError = (
  error: unknown,
  {
    log,
    requestId,
    instance,
    operation,
  }: { log: ReturnType<typeof logger.withContext>; requestId: string; instance: string; operation: string }
): Response => {
  if (error instanceof CreativeReferenceError) {
    log.warn(
      { statusCode: 422, invalidParams: error.invalidParams },
      "Creative references failed validation"
    );
    return problemInvalidCreative(requestId, instance, error.invalidParams);
  }
  if (error instanceof CustomCssPlanRequiredError) {
    log.warn({ statusCode: 403 }, "Creative custom CSS needs the plan");
    return problemCustomCssPlanRequired(requestId, error.message, instance);
  }
  if (error instanceof CustomCssInvalidError) {
    log.warn({ statusCode: 422 }, "Creative custom CSS failed validation");
    return problemCustomCssInvalid(requestId, {
      invalid_params: customCssErrorsToInvalidParams(error.errors, CUSTOM_CSS_FIELD),
      errors: capCustomCssIssues(error.errors),
      instance,
    });
  }
  return mapV3ThrownError(error, { log, requestId, instance, operation });
};

/**
 * Authorizes the caller for one creative and loads it, scoped by `{ creativeId, workspaceId }`. A
 * creative deleted in between answers the same 403 as an unknown one.
 */
const loadAuthorizedCreative = async (
  { creativeId, authentication, requestId, instance }: TCreativeOperationParams,
  access: "read" | "readWrite"
): Promise<{ response: Response } | { record: TCreativeRecord; organizationId: string }> => {
  const authorized = await authorizeCreative({ creativeId, authentication, access, requestId, instance });
  if (authorized instanceof Response) return { response: authorized };

  const record = await findCreativeRecord(authorized.creativeId, authorized.workspaceId);
  if (!record) {
    return {
      response: problemForbidden(requestId, "You are not authorized to access this resource", instance),
    };
  }
  return { record, organizationId: authorized.organizationId };
};

export async function listV3Creatives({
  searchParams,
  authentication,
  requestId,
  instance,
}: Omit<TOperationContext, "auditLog"> & { searchParams: URLSearchParams }): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const parsed = parseV3CreativesListQuery(searchParams);
    if (!parsed.ok) {
      log.warn({ statusCode: 400, invalidParams: parsed.invalidParams }, "Validation failed");
      return problemBadRequest(requestId, "Invalid query parameters", {
        invalid_params: parsed.invalidParams,
        instance,
      });
    }
    const { query } = parsed;

    const authorized = await authorizeCreativeWorkspace({
      workspaceId: query.workspaceId,
      authentication,
      access: "read",
      requestId,
      instance,
    });
    if (authorized instanceof Response) return authorized;

    const now = new Date();
    const rows = await findCreativeRecordsPage({
      workspaceId: authorized.workspaceId,
      sortBy: query.sortBy,
      after: query.after,
      take: query.limit + 1,
      name: query.name,
      types: query.types,
      surveyId: query.surveyId,
      displayStatuses: query.displayStatuses,
      now,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return successListResponse(
      page.map((record) => serializeV3Creative(record, now)),
      { limit: query.limit, nextCursor: rows.length > query.limit && last ? query.nextCursor(last) : null },
      { requestId }
    );
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "creatives.list" });
  }
}

export async function createV3Creative({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TOperationContext & { body: TV3CreateCreativeBody }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  try {
    const authorized = await authorizeCreativeWorkspace({
      workspaceId: body.workspaceId,
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });
    if (authorized instanceof Response) return authorized;

    const now = new Date();
    const state = buildCreativeCreateState(body, now);
    const problems = validateCreativeState(state);
    if (problems.length > 0) {
      log.warn({ statusCode: 422, invalidParams: problems }, "Creative failed validation");
      return problemInvalidCreative(requestId, instance, problems);
    }
    await assertCustomCssWrite(null, state, authorized.organizationId, authentication);

    const record = await createCreative({
      workspaceId: authorized.workspaceId,
      createdBy: getV3SessionUserId(authentication),
      state,
    });
    const resource = serializeV3Creative(record, now);
    recordAudit(auditLog, authorized.organizationId, record.id, { newObject: resource });

    return createdResponse(resource, {
      location: creativeLocation(record.id),
      requestId,
    });
  } catch (error) {
    return mapWriteError(error, { log, requestId, instance, operation: "creatives.create" });
  }
}

export async function getV3Creative(params: Omit<TCreativeOperationParams, "auditLog">): Promise<Response> {
  const { creativeId, requestId, instance } = params;
  const log = logger.withContext({ requestId, creativeId });

  try {
    const loaded = await loadAuthorizedCreative(params, "read");
    if ("response" in loaded) return loaded.response;

    return successResponse(serializeV3Creative(loaded.record, new Date()), { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "creatives.get" });
  }
}

export async function patchV3Creative(
  params: TCreativeOperationParams & { body: TV3PatchCreativeBody }
): Promise<Response> {
  const { creativeId, body, requestId, instance, auditLog } = params;
  const log = logger.withContext({ requestId, creativeId });

  try {
    const loaded = await loadAuthorizedCreative(params, "readWrite");
    if ("response" in loaded) return loaded.response;
    const { record, organizationId } = loaded;

    const now = new Date();
    const before = serializeV3Creative(record, now);
    if (record.archivedAt) {
      log.warn({ statusCode: 422 }, "Creative is archived");
      return problemCreativeArchived(requestId, instance);
    }
    // An empty patch changes nothing, `updatedAt` included.
    if (Object.keys(body).length === 0) return successResponse(before, { requestId });

    const previous = toCreativeState(record);
    const planned = applyCreativePatch(previous, body, now);
    const problems = planned.ok ? validateCreativeState(planned.state, previous) : planned.invalidParams;
    if (!planned.ok || problems.length > 0) {
      log.warn({ statusCode: 422, invalidParams: problems }, "Creative failed validation");
      return problemInvalidCreative(requestId, instance, problems);
    }
    await assertCustomCssWrite(previous, planned.state, organizationId, params.authentication);

    const updated = await updateCreative({
      creativeId: record.id,
      workspaceId: record.workspaceId,
      previous,
      next: planned.state,
    });
    const resource = serializeV3Creative(updated, now);
    recordAudit(auditLog, organizationId, record.id, { oldObject: before, newObject: resource });

    return successResponse(resource, { requestId });
  } catch (error) {
    return mapWriteError(error, { log, requestId, instance, operation: "creatives.patch" });
  }
}

export async function deleteV3Creative(params: TCreativeOperationParams): Promise<Response> {
  const { creativeId, requestId, instance, auditLog } = params;
  const log = logger.withContext({ requestId, creativeId });

  try {
    const loaded = await loadAuthorizedCreative(params, "readWrite");
    if ("response" in loaded) return loaded.response;
    const { record, organizationId } = loaded;

    recordAudit(auditLog, organizationId, record.id, { oldObject: serializeV3Creative(record, new Date()) });
    await deleteCreative(record.id, record.workspaceId);

    return noContentResponse({ requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "creatives.delete" });
  }
}

/** Archive and restore: authorize, run the lifecycle change, audit before and after, return the resource. */
const runLifecycleOperation = async (
  params: TCreativeOperationParams,
  operation: "archive" | "restore",
  mutate: (record: TCreativeRecord, now: Date) => Promise<TCreativeRecord>
): Promise<Response> => {
  const { creativeId, requestId, instance, auditLog } = params;
  const log = logger.withContext({ requestId, creativeId });

  try {
    const loaded = await loadAuthorizedCreative(params, "readWrite");
    if ("response" in loaded) return loaded.response;
    const { record, organizationId } = loaded;

    const now = new Date();
    const resource = serializeV3Creative(await mutate(record, now), now);
    recordAudit(auditLog, organizationId, record.id, {
      oldObject: serializeV3Creative(record, now),
      newObject: resource,
    });

    return successResponse(resource, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: `creatives.${operation}` });
  }
};

export const archiveV3Creative = (params: TCreativeOperationParams): Promise<Response> =>
  runLifecycleOperation(params, "archive", archiveCreative);

export const restoreV3Creative = (params: TCreativeOperationParams): Promise<Response> =>
  runLifecycleOperation(params, "restore", (record) => restoreCreative(record));

export async function duplicateV3Creative(params: TCreativeOperationParams): Promise<Response> {
  const { creativeId, authentication, requestId, instance, auditLog } = params;
  const log = logger.withContext({ requestId, creativeId });

  try {
    const loaded = await loadAuthorizedCreative(params, "readWrite");
    if ("response" in loaded) return loaded.response;
    const { record, organizationId } = loaded;

    const copy = await duplicateCreative({ record, createdBy: getV3SessionUserId(authentication) });
    const resource = serializeV3Creative(copy, new Date());
    recordAudit(auditLog, organizationId, copy.id, { newObject: resource });

    return createdResponse(resource, {
      location: creativeLocation(copy.id),
      requestId,
    });
  } catch (error) {
    return mapWriteError(error, { log, requestId, instance, operation: "creatives.duplicate" });
  }
}

/**
 * A creative's Impressions and Clicks per UTC day, from the rollups the counter flush writes
 * (ENG-4000). Read access, like `getV3Creative`; archived creatives keep their counts.
 */
export async function getV3CreativeStats(
  params: Omit<TCreativeOperationParams, "auditLog"> & { query: TV3CreativeStatsQuery }
): Promise<Response> {
  const { creativeId, query, authentication, requestId, instance } = params;
  const log = logger.withContext({ requestId, creativeId });

  try {
    const authorized = await authorizeCreative({
      creativeId,
      authentication,
      access: "read",
      requestId,
      instance,
    });
    if (authorized instanceof Response) return authorized;

    const resolved = resolveStatsRange(query, new Date());
    if (!resolved.ok) {
      return problemBadRequest(requestId, "Invalid query parameters", {
        invalid_params: [resolved.invalidParam],
        instance,
      });
    }

    const { range } = resolved;
    const groupBy = query.groupBy ?? null;
    const { workspaceId } = authorized;
    const [dayDeviceCounts, pageCounts] = await Promise.all([
      findCreativeDayDeviceCounts(creativeId, workspaceId, range.from, range.to),
      groupBy === "page"
        ? findCreativePageCounts(creativeId, workspaceId, range.from, range.to, MAX_STATS_PAGES)
        : [],
    ]);

    return successResponse(buildCreativeStats({ creativeId, range, groupBy, dayDeviceCounts, pageCounts }), {
      requestId,
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "creatives.stats" });
  }
}
