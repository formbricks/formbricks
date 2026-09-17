import "server-only";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type {
  TResponseData,
  TResponseDataValue,
  TResponseMeta,
  TResponseTtc,
} from "@formbricks/types/responses";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  type InvalidParam,
  problemBadRequest,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { planV3ResponseCreate, planV3ResponsePatch } from "./operations";
import {
  type TV3ResponseValidationRequestBody,
  ZV3CreateResponseBody,
  ZV3PatchResponseBody,
  ZV3ResponseValidationRequestBody,
} from "./schemas";
import { getResponseWorkspaceId, getScopedV3Response } from "./service";
import { type TV3ResponseValidationEffects, createEffects, patchEffects } from "./validate-effects";
import { normalizeV3Ttc, totalStoredV3Ttc } from "./write-plan";
import { collectReferenceIssues, getSurveyForV3Write } from "./write-service";

type TValidateParams = {
  body: TV3ResponseValidationRequestBody;
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

type TV3ResponseValidationResult = {
  valid: boolean;
  operation: "create" | "patch";
  invalid_params: InvalidParam[];
  effects?: TV3ResponseValidationEffects;
};

const invalid = (operation: "create" | "patch", invalidParams: InvalidParam[], requestId: string): Response =>
  successResponse<TV3ResponseValidationResult>(
    { valid: false, operation, invalid_params: invalidParams },
    { requestId, cache: "private, no-store" }
  );

const valid = (
  operation: "create" | "patch",
  effects: TV3ResponseValidationEffects,
  requestId: string
): Response =>
  successResponse<TV3ResponseValidationResult>(
    { valid: true, operation, invalid_params: [], effects },
    { requestId, cache: "private, no-store" }
  );

/**
 * The scope anchor, read before anything else in the document is trusted.
 *
 * A create's workspace is resolved from `data.surveyId`, so it has to be readable before the rest of
 * the document is judged — the same ordering `createV3Response` uses and for the same reason: a
 * distinct answer for "no such survey" would let any valid key probe another tenant's id space.
 */
const ZSurveyAnchor = z.object({ surveyId: z.cuid2() });

/**
 * `POST /api/v3/responses/validate` → 200 `{ data }`.
 *
 * Runs everything the real write runs and stops where the write would start writing. Both branches
 * call the same planners `POST` and `PATCH` call, and the same reference checks, so a payload this
 * answers `valid: true` for is one those operations accept — the point of the endpoint is that the
 * two agree, not that this one is clever.
 *
 * **Three orderings are load-bearing, all inherited from the operations being validated:**
 *
 * 1. **Authorization first, and it is the operation's own.** `readWrite`, resolved from the survey
 *    (create) or the response (patch). Validating at `read` would make this a cheaper existence
 *    probe than the write it describes, which is the one thing a dry run must not be.
 * 2. **A missing and a foreign id answer identically**, with the same 403 body the write gives.
 * 3. **Schema, then plan, then references** — never merged. The write reports them in that order
 *    because each stage needs the previous one to have passed; a merged report would describe a
 *    document the later stages never saw.
 *
 * A `200` means the check ran, not that the payload is valid. Nothing here writes, enqueues or
 * meters.
 */
export async function validateV3Response({
  body,
  authentication,
  requestId,
  instance,
}: TValidateParams): Promise<Response> {
  const log = logger.withContext({
    requestId,
    ...(body.operation === "patch" ? { responseId: body.responseId } : {}),
  });

  try {
    if (body.operation === "create") {
      return await validateCreate({ document: body.data, authentication, requestId, instance });
    }

    return await validatePatch({
      responseId: body.responseId,
      document: body.data,
      authentication,
      requestId,
      instance,
    });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.validate",
    });
  }
}

async function validateCreate({
  document,
  authentication,
  requestId,
  instance,
}: {
  document: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const anchor = ZSurveyAnchor.safeParse(document);

  if (!anchor.success) {
    // No `surveyId` means no scope to authorize against and none to disclose, so the caller is told
    // what is wrong with their document rather than being refused.
    return invalid("create", formatZodIssues(anchor.error, "data"), requestId);
  }

  const survey = await getSurveyForV3Write(anchor.data.surveyId);

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

  const parsed = ZV3CreateResponseBody.safeParse(document);

  if (!parsed.success) {
    return invalid("create", formatZodIssues(parsed.error, "data"), requestId);
  }

  const plan = await planV3ResponseCreate({ survey, body: parsed.data });

  if (!plan.ok) {
    return invalid("create", plan.issues, requestId);
  }

  const references = await collectReferenceIssues(prisma, {
    workspaceId: survey.workspaceId,
    surveyId: survey.id,
    contactId: parsed.data.contactId,
    displayId: parsed.data.displayId,
    singleUseId: parsed.data.singleUseId,
    tagIds: parsed.data.tags,
  });

  if (references.issues.length > 0) {
    return invalid("create", references.issues, requestId);
  }

  const effects = await createEffects({
    survey,
    organizationId: access.organizationId,
    requestId,
    finished: parsed.data.finished,
    language: plan.storedLanguage,
    data: plan.composed.data ?? {},
    variables: (plan.composed.variables ?? {}) as Record<string, TResponseDataValue>,
    ttc: normalizeV3Ttc(parsed.data.ttc, parsed.data.finished),
    meta: (parsed.data.meta ?? {}) as TResponseMeta,
    contactId: parsed.data.contactId,
    displayId: parsed.data.displayId,
  });

  return valid("create", effects, requestId);
}

async function validatePatch({
  responseId,
  document,
  authentication,
  requestId,
  instance,
}: {
  responseId: string;
  document: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
}): Promise<Response> {
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

  const parsed = ZV3PatchResponseBody.safeParse(document);

  if (!parsed.success) {
    return invalid("patch", formatZodIssues(parsed.error, "data"), requestId);
  }

  const planned = await planV3ResponsePatch({ survey, body: parsed.data, stored });

  if (!planned.ok) {
    return invalid("patch", planned.issues, requestId);
  }

  const references = await collectReferenceIssues(prisma, {
    workspaceId,
    surveyId: survey.id,
    tagIds: parsed.data.tags,
    excludeResponseId: responseId,
  });

  if (references.issues.length > 0) {
    return invalid("patch", references.issues, requestId);
  }

  const finished = parsed.data.finished ?? stored.finished;

  const effects = await patchEffects({
    survey,
    stored,
    requestId,
    finished,
    // `_total` is derived by the write on any patch that finishes a response, and a `reserved` quota
    // operand on `durationSeconds` reads it. Screening the stored `ttc` instead would answer about
    // the response as it is rather than as the patch would leave it.
    ttc:
      parsed.data.finished === true && !stored.finished
        ? totalStoredV3Ttc(stored.ttc as Record<string, unknown> | undefined)
        : ((stored.ttc ?? {}) as TResponseTtc),
    language: planned.effectiveLanguage,
    data: planned.composed.data ?? (stored.data as TResponseData) ?? {},
    variables: (planned.composed.variables ??
      (stored.variables as Record<string, TResponseDataValue>) ??
      {}) as Record<string, TResponseDataValue>,
    // A patch that omits `tags` leaves the stored set alone; one that carries it replaces the set,
    // deduplicated exactly as the write deduplicates before writing the join rows.
    tagsToApply: [...new Set(parsed.data.tags ?? stored.tags.map(({ tag }) => tag.id))],
  });

  return valid("patch", effects, requestId);
}

/**
 * The MCP entry point: the same operation, with the envelope parsed here rather than by the route
 * wrapper. The tool passes a raw object, so the 400 that a malformed envelope earns has to be built
 * on this side.
 */
export async function validateV3ResponseFromRawInput({
  body,
  authentication,
  requestId,
  instance,
}: Omit<TValidateParams, "body"> & { body: unknown }): Promise<Response> {
  const parsed = ZV3ResponseValidationRequestBody.safeParse(body);

  if (!parsed.success) {
    return problemBadRequest(requestId, "Invalid response validation request", {
      invalid_params: formatZodIssues(parsed.error, "body"),
      instance,
    });
  }

  return await validateV3Response({ body: parsed.data, authentication, requestId, instance });
}
