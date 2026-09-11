import "server-only";
import { logger } from "@formbricks/logger";
import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import {
  type InvalidParam,
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getWorkspaceLegacyStoragePrefixes } from "@/lib/workspace/service";
import { validateResponseData } from "@/modules/api/lib/validation";
import { validateClientFileUploads } from "@/modules/storage/utils";
import { buildAnswerPlan } from "./answers";
import { resolveV3LabelContext } from "./label-resolution";
import {
  RESPONSES_CURSOR_KIND,
  type TV3InvalidParam,
  parseV3ResponsesCountQuery,
  parseV3ResponsesListQuery,
} from "./parse-v3-responses-list-query";
import type { TV3CreateResponseBody, TV3PatchResponseBody } from "./schemas";
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
import {
  normalizeV3Ttc,
  planAnswerDataWrite,
  planEmbeddedDataWrite,
  resolveV3WriteLanguage,
  totalStoredV3Ttc,
  validateV3EndingId,
} from "./write-plan";
import {
  type TV3WriteSurveyRow,
  createScopedResponse,
  dispatchV3ResponsePipeline,
  getSurveyForV3Write,
  readbackV3Response,
  updateScopedResponse,
} from "./write-service";

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

/**
 * Compose one write's two stored maps, or the reasons it cannot be composed.
 *
 * Shared by create and patch because the rules are identical — what differs is only which keys the
 * payload carried and whether there is a stored row underneath. Every issue it returns is a 422:
 * each one needed the survey definition to detect, which is precisely the line the contract draws
 * between 400 and 422 on these operations.
 */
function composeV3ResponseWrite({
  plan,
  survey,
  body,
  stored,
}: {
  plan: ReturnType<typeof buildAnswerPlan>;
  survey: TV3WriteSurveyRow;
  body: { data?: TResponseData; embeddedData?: Record<string, string | number | boolean | null> };
  stored: { data: TResponseData; variables: Record<string, TResponseDataValue> } | undefined;
}): {
  issues: InvalidParam[];
  data: TResponseData | undefined;
  variables: Record<string, TResponseDataValue> | undefined;
} {
  const issues: InvalidParam[] = [];

  let data = stored?.data;
  let dataTouched = false;

  if (body.data !== undefined) {
    const answerPlan = planAnswerDataWrite(plan, body.data, stored?.data);
    issues.push(...answerPlan.issues);
    data = answerPlan.data;
    dataTouched = true;
  }

  let variables = stored?.variables;
  let variablesTouched = false;

  if (body.embeddedData !== undefined) {
    const embeddedPlan = planEmbeddedDataWrite({
      embeddedFields: survey.embeddedFields ?? [],
      elementIds: new Set(plan.elementById.keys()),
      incoming: body.embeddedData,
    });
    issues.push(...embeddedPlan.issues);

    // Applied over whatever the answer step produced, which is what makes `embeddedData` a merge
    // while `data` is a replacement: a field the payload omits keeps the value already in the map.
    const nextData: TResponseData = { ...data, ...embeddedPlan.dataWrites };
    for (const key of embeddedPlan.dataClears) delete nextData[key];
    data = nextData;
    dataTouched =
      dataTouched || embeddedPlan.dataClears.length > 0 || Object.keys(embeddedPlan.dataWrites).length > 0;

    const nextVariables = { ...variables, ...embeddedPlan.variableWrites };
    for (const key of embeddedPlan.variableClears) delete nextVariables[key];
    variables = nextVariables;
    variablesTouched =
      embeddedPlan.variableClears.length > 0 || Object.keys(embeddedPlan.variableWrites).length > 0;
  }

  return {
    issues,
    data: dataTouched ? (data ?? {}) : undefined,
    variables: variablesTouched ? (variables ?? {}) : undefined,
  };
}

/**
 * File-upload answers must point at files this workspace, survey and element own.
 *
 * Every v1 and v2 write path runs this, and omitting it is not a cosmetic gap: a stored answer is a
 * storage path that later gets resolved into a signed URL by the dashboard, the export and the read
 * endpoints. A caller with write access to workspace A could otherwise store
 * `/storage/{workspaceB}/private/surveys/…` under a file-upload element and have it resolved on
 * their own response — the cross-tenant storage reference ENG-1981 closed on the management routes.
 *
 * `legacyOwnedStoragePrefixes` is passed for the same reason the management routes pass it: this is a
 * management-plane API, and a caller replaying an old response carries file URLs that predate the
 * scoped shape. The client widget path stays strict without it.
 *
 * 422 rather than v1/v2's 400, because the check needs the survey definition — the line this
 * contract draws between the two.
 */
async function fileUploadIssues(
  survey: TV3WriteSurveyRow,
  data: TResponseData | undefined
): Promise<InvalidParam[]> {
  if (!data) return [];

  const valid = validateClientFileUploads({
    data,
    workspaceId: survey.workspaceId,
    surveyId: survey.id,
    blocks: survey.blocks as never,
    questions: survey.questions as never,
    legacyOwnedStoragePrefixes: await getWorkspaceLegacyStoragePrefixes(survey.workspaceId),
  });

  if (valid) return [];

  return [
    {
      name: "data",
      reason: "A file-upload answer references a file that does not belong to this survey's upload element.",
      code: "invalid_reference",
      referenceType: "element",
    },
  ];
}

/** Survey validation-rule failures, itemized per element rather than collapsed into one message. */
function answerValidationIssues(
  survey: TV3WriteSurveyRow,
  data: TResponseData | undefined,
  language: string | null
) {
  const errorMap = validateResponseData(
    survey.blocks as unknown[],
    data,
    language ?? "en",
    survey.questions as never
  );

  if (!errorMap) return [];

  return Object.entries(errorMap).flatMap(([elementId, errors]) =>
    errors.map((error) => ({
      name: elementId,
      reason: error.message,
      referenceType: "element" as const,
      identifier: error.ruleId,
    }))
  );
}

type TWriteParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * `POST /api/v3/responses` → 201 `{ data }` with a `Location` header.
 *
 * **The workspace is resolved from `surveyId`, and a survey the caller cannot write to answers 403
 * whether it is missing or someone else's.** The contract's 422 list named an unresolvable
 * `surveyId` alongside `endingId`, `contactId` and the rest, but it does not belong with them: those
 * are checked *after* authorization, inside a workspace the caller already holds, so they disclose
 * nothing. `surveyId` is the scope anchor and is necessarily checked *before* it — a distinct answer
 * for "no such survey" would let any valid key probe the id space of every other tenant. The spec
 * has been corrected to match; see `api_v3_responses.yml`.
 */
export async function createV3Response({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TWriteParams & { body: TV3CreateResponseBody }): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId: body.surveyId });

  try {
    const survey = await getSurveyForV3Write(body.surveyId);

    if (!survey) {
      return problemForbidden(requestId, undefined, instance);
    }

    const access = await requireV3WorkspaceAccess(
      authentication,
      survey.workspaceId,
      "readWrite",
      requestId,
      instance
    );

    if (access instanceof Response) {
      return access;
    }

    // Resolved before the plan is built: the language the response will carry decides which labels
    // the answers are validated against, and it is the survey's own code rather than the caller's.
    const language = resolveV3WriteLanguage(survey.languages, body.language);
    const storedLanguage = language.ok ? language.code : null;
    const { lookupKey } = resolveV3LabelContext(survey.languages, storedLanguage);
    const plan = buildAnswerPlan(
      survey.blocks as never,
      lookupKey,
      (survey.embeddedFields ?? [])
        .filter(({ field }) => field.source === "ingested")
        .map(({ link }) => link.storageKey)
    );

    const composed = composeV3ResponseWrite({ plan, survey, body, stored: undefined });
    const issues: InvalidParam[] = [
      ...composed.issues,
      ...(language.ok ? [] : [language.issue]),
      ...[validateV3EndingId(survey.endings, body.endingId)].filter(
        (issue): issue is InvalidParam => issue !== null
      ),
      ...answerValidationIssues(survey, composed.data, storedLanguage),
      ...(await fileUploadIssues(survey, composed.data)),
    ];

    if (issues.length > 0) {
      return problemUnprocessableContent(requestId, "The response conflicts with the survey definition", {
        invalid_params: issues,
        instance,
      });
    }

    const outcome = await createScopedResponse({
      workspaceId: survey.workspaceId,
      survey,
      finished: body.finished,
      data: composed.data ?? {},
      variables: composed.variables ?? {},
      ttc: normalizeV3Ttc(body.ttc, body.finished),
      meta: body.meta,
      tagIds: body.tags ?? [],
      endingId: body.endingId,
      language: storedLanguage,
      contactId: body.contactId,
      displayId: body.displayId,
      singleUseId: body.singleUseId,
    });

    if (!outcome.ok) {
      return problemUnprocessableContent(requestId, "The response conflicts with stored data", {
        invalid_params: outcome.issues,
        instance,
      });
    }

    const row = await readbackV3Response(outcome.responseId, { workspaceId: survey.workspaceId });

    if (!row) {
      // Deleted between the commit and the read back. Nothing truthful is left to return, and the
      // row genuinely existed, so this is a server-side race rather than a caller error.
      return mapV3ThrownError(new Error("Created response disappeared before read-back"), {
        log,
        requestId,
        instance: instance ?? "",
        operation: "responses.create",
      });
    }

    if (auditLog) {
      auditLog.targetId = row.id;
      auditLog.organizationId = access.organizationId;
      auditLog.newObject = { id: row.id, surveyId: row.surveyId, finished: row.finished };
    }

    const resource = createV3ResponseSerializer().toResource(row, survey);

    // After the commit, and never fatal — see `dispatchV3ResponsePipeline`. `finished` comes from the
    // persisted row because quota evaluation can finish a response submitted as partial.
    await dispatchV3ResponsePipeline({
      event: "responseCreated",
      workspaceId: survey.workspaceId,
      surveyId: survey.id,
      response: row,
      alsoFinished: row.finished,
    });

    return createdResponse(resource, {
      location: `/api/v3/responses/${row.id}`,
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.create",
    });
  }
}

/**
 * `PATCH /api/v3/responses/{responseId}` → 200 `{ data }`.
 *
 * `responseFinished` fires on the **transition** to finished, not on every patch of a response that
 * is already finished. v1 and v2 both re-emit, and this deliberately does not: the contract defines
 * the event as firing "for a patch that transitions the response to finished"
 * (`ResponseValidationEffects.firesPipeline`), and re-emitting means a correction to a typo in a
 * finished response re-runs every webhook, integration and follow-up email the original submission
 * ran. Worth knowing when comparing against the older paths.
 */
export async function updateV3Response({
  responseId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TWriteParams & { responseId: string; body: TV3PatchResponseBody }): Promise<Response> {
  const log = logger.withContext({ requestId, responseId });

  try {
    const workspaceId = await getResponseWorkspaceId(responseId);

    if (!workspaceId) {
      return problemForbidden(requestId, undefined, instance);
    }

    const access = await requireV3WorkspaceAccess(
      authentication,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );

    if (access instanceof Response) {
      return access;
    }

    const stored = await getScopedV3Response(responseId, { workspaceId });

    if (!stored) {
      return problemForbidden(requestId, undefined, instance);
    }

    const survey = await getSurveyForV3Write(stored.surveyId);

    if (!survey) {
      return problemForbidden(requestId, undefined, instance);
    }

    // The language the response will carry *after* this patch, so a payload that changes language and
    // answers in one call is validated against the labels it is about to have rather than the old ones.
    const patchLanguage =
      body.language === undefined
        ? { ok: true as const, code: stored.language }
        : resolveV3WriteLanguage(survey.languages, body.language);
    const effectiveLanguage = patchLanguage.ok ? patchLanguage.code : null;
    const { lookupKey } = resolveV3LabelContext(survey.languages, effectiveLanguage);
    const plan = buildAnswerPlan(
      survey.blocks as never,
      lookupKey,
      (survey.embeddedFields ?? [])
        .filter(({ field }) => field.source === "ingested")
        .map(({ link }) => link.storageKey)
    );

    const composed = composeV3ResponseWrite({
      plan,
      survey,
      body,
      stored: {
        data: (stored.data ?? {}) as TResponseData,
        variables: (stored.variables ?? {}) as Record<string, TResponseDataValue>,
      },
    });

    const issues: InvalidParam[] = [
      ...composed.issues,
      ...(patchLanguage.ok ? [] : [patchLanguage.issue]),
      ...[body.endingId === undefined ? null : validateV3EndingId(survey.endings, body.endingId)].filter(
        (issue): issue is InvalidParam => issue !== null
      ),
      ...(body.data === undefined ? [] : answerValidationIssues(survey, composed.data, effectiveLanguage)),
      ...(await fileUploadIssues(survey, composed.data)),
    ];

    if (issues.length > 0) {
      return problemUnprocessableContent(requestId, "The response conflicts with the survey definition", {
        invalid_params: issues,
        instance,
      });
    }

    const outcome = await updateScopedResponse({
      responseId,
      workspaceId,
      survey,
      patch: {
        finished: body.finished,
        // `_total` is derived, not caller-supplied, and the shared update service computes it on any
        // write that finishes a response. Without it a response created partial and finished here
        // carries per-element timings but reports no duration at all.
        ...(body.finished === true && !stored.finished
          ? { ttc: totalStoredV3Ttc(stored.ttc as Record<string, unknown> | undefined) }
          : {}),
        endingId: body.endingId,
        // Only when the payload carried it — and then as the survey's own code, never the caller's.
        language: body.language === undefined ? undefined : effectiveLanguage,
        data: composed.data,
        variables: composed.variables,
        tagIds: body.tags,
      },
    });

    if (!outcome.ok) {
      return problemUnprocessableContent(requestId, "The response conflicts with stored data", {
        invalid_params: outcome.issues,
        instance,
      });
    }

    const row = await readbackV3Response(responseId, { workspaceId });

    if (!row) {
      return problemForbidden(requestId, undefined, instance);
    }

    if (auditLog) {
      auditLog.targetId = responseId;
      auditLog.organizationId = access.organizationId;
      auditLog.oldObject = { id: stored.id, finished: stored.finished };
      auditLog.newObject = { id: row.id, finished: row.finished };
    }

    const resource = createV3ResponseSerializer().toResource(row, survey);

    await dispatchV3ResponsePipeline({
      event: "responseUpdated",
      workspaceId,
      surveyId: survey.id,
      response: row,
      // The transition, not the state — see the note on this function.
      alsoFinished: !stored.finished && row.finished,
    });

    return successResponse(resource, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.update",
    });
  }
}
