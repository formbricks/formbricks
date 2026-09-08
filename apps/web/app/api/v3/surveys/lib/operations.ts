import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurvey as TInternalSurvey } from "@formbricks/types/surveys/types";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  type InvalidParam,
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemInternalError,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { capturePostHogEvent } from "@/lib/posthog";
import { archiveSurvey, deleteSurvey, restoreSurvey } from "@/modules/survey/lib/surveys";
import { getSurveyCount, getWorkspaceSurveyCount } from "@/modules/survey/list/lib/survey";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";
import { getAuthorizedV3Survey } from "../authorization";
import {
  applySurveyBlockOperations,
  readPublicBlocks,
  remapBlockInvalidParamPath,
  reorderSurveyBlocks,
} from "../blocks";
import {
  type TV3SurveyCreateOptions,
  V3SurveyCreatePermissionError,
  V3SurveyInputValidationError,
  createV3Survey,
} from "../create";
import { parseV3SurveysListQuery } from "../parse-v3-surveys-list-query";
import {
  type TV3SurveyWritePrecondition,
  V3SurveyStaleError,
  V3SurveyStoredDocumentError,
  patchV3Survey,
} from "../patch";
import {
  type TV3SurveyPrepareResult,
  prepareV3SurveyCreateInput,
  prepareV3SurveyPatchInput,
} from "../prepare";
import { V3SurveyReferenceValidationError } from "../reference-validation";
import {
  type TV3CreateSurveyBody,
  type TV3SurveyDocument,
  type TV3SurveyValidationRequestBody,
  ZV3CreateSurveyBody,
  ZV3EditSurveyBlocksBody,
  ZV3SetSurveyBlockOrderBody,
  ZV3SurveyValidationRequestBody,
  formatV3ZodInvalidParams,
} from "../schemas";
import {
  V3SurveyLanguageError,
  V3SurveyUnsupportedShapeError,
  serializeV3SurveyListItem,
  serializeV3SurveyResource,
} from "../serializers";
import { V3SurveyWritePermissionError } from "../write-permissions";

type TListV3SurveysParams = {
  searchParams: URLSearchParams;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

type TCreateV3SurveyParams = {
  body: TV3CreateSurveyBody;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
  createdFrom?: "blank" | "template" | "xm-template" | "ai";
  createOptions?: TV3SurveyCreateOptions;
  authResult?: V3WorkspaceContext;
};

type TRawCreateV3SurveyParams = Omit<TCreateV3SurveyParams, "body"> & {
  body: unknown;
};

type TGetV3SurveyParams = {
  surveyId: string;
  lang?: string[];
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

// Shared shape for the single-survey mutation operations (delete, archive, restore): all locate the
// survey by its globally-unique id and enforce readWrite access + audit.
type TV3SurveyMutationParams = {
  surveyId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

type TPatchV3SurveyParams = {
  surveyId: string;
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

type TValidateV3SurveyParams = {
  body: TV3SurveyValidationRequestBody;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

type TRawValidateV3SurveyParams = Omit<TValidateV3SurveyParams, "body"> & {
  body: unknown;
};

const createWorkspaceIdSchema = z.object({
  workspaceId: z.cuid2(),
});

export function getSessionUserId(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }

  return null;
}

function serializeValidationResult<TDocument extends TV3SurveyDocument>(
  operation: "create" | "patch",
  preparation: TV3SurveyPrepareResult<TDocument>
) {
  if (!preparation.ok) {
    return {
      valid: false,
      operation,
      invalid_params: preparation.validation.invalidParams,
    };
  }

  return {
    valid: true,
    operation,
    invalid_params: [],
    languages: preparation.languageRequests.map((languageRequest) => ({
      ...languageRequest,
      writeBehavior: "connect_or_create" as const,
    })),
  };
}

export async function listV3Surveys({
  searchParams,
  authentication,
  requestId,
  instance,
}: TListV3SurveysParams): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    const parsed = parseV3SurveysListQuery(searchParams);
    if (!parsed.ok) {
      log.warn({ statusCode: 400, invalidParams: parsed.invalid_params }, "Validation failed");
      return problemBadRequest(requestId, "Invalid query parameters", {
        invalid_params: parsed.invalid_params,
        instance,
      });
    }

    const authResult = await requireV3WorkspaceAccess(
      authentication,
      parsed.workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return authResult;
    }

    const { workspaceId } = authResult;

    const surveyPagePromise = getSurveyListPage(workspaceId, {
      limit: parsed.limit,
      cursor: parsed.cursor,
      sortBy: parsed.sortBy,
      filterCriteria: parsed.filterCriteria,
    });
    // Both counts are gated on includeTotalCount alone. The list client sends it only on the first
    // page and reads them from pages[0].meta, but any caller can ask for them on a cursor request.
    const totalCountPromise = parsed.includeTotalCount
      ? getSurveyCount(workspaceId, parsed.filterCriteria)
      : Promise.resolve(null);
    const workspaceSurveyCountPromise = parsed.includeTotalCount
      ? getWorkspaceSurveyCount(workspaceId)
      : Promise.resolve(null);
    const [surveyPage, totalCount, workspaceSurveyCount] = await Promise.all([
      surveyPagePromise,
      totalCountPromise,
      workspaceSurveyCountPromise,
    ]);

    return successListResponse(
      surveyPage.surveys.map(serializeV3SurveyListItem),
      {
        limit: parsed.limit,
        nextCursor: surveyPage.nextCursor,
        totalCount,
        workspaceSurveyCount,
      },
      { requestId, cache: "private, no-store" }
    );
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      log.warn({ statusCode: 403, errorCode: err.name }, "Resource not found");
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }
    if (err instanceof DatabaseError) {
      log.error({ error: err, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
    log.error({ error: err, statusCode: 500 }, "V3 surveys list unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

/**
 * Map an error thrown during survey creation to its problem+json Response. Extracted from
 * createV3SurveyResponse to keep that handler's cognitive complexity within bounds.
 */
function mapV3SurveyCreateError(
  err: unknown,
  {
    log,
    requestId,
    instance,
  }: { log: ReturnType<typeof logger.withContext>; requestId: string; instance: string }
): Response {
  if (err instanceof V3SurveyReferenceValidationError) {
    // Well-formed JSON that fails semantic/reference validation (dangling refs, duplicate ids,
    // undeclared locales, invalid media, unknown action-class ids) → 422, not 400 (which is reserved
    // for malformed/unknown-field requests rejected at the schema layer).
    log.warn({ statusCode: 422, invalidParams: err.invalidParams }, "Survey document validation failed");
    return problemUnprocessableContent(requestId, "Survey document failed validation", {
      invalid_params: err.invalidParams,
      instance,
    });
  }
  if (err instanceof V3SurveyUnsupportedShapeError) {
    log.warn({ statusCode: 400, errorCode: err.name }, "Unsupported survey shape");
    return problemBadRequest(requestId, err.message, {
      invalid_params: [{ name: "body", reason: err.message }],
      instance,
    });
  }
  if (err instanceof V3SurveyCreatePermissionError) {
    log.warn({ statusCode: 403, errorCode: err.name }, "Survey create permission check failed");
    return problemForbidden(requestId, err.message, instance);
  }
  if (err instanceof ResourceNotFoundError) {
    log.warn({ statusCode: 403, errorCode: err.name }, "Resource not found");
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }
  if (err instanceof InvalidInputError) {
    log.warn({ statusCode: 400, errorCode: err.name }, "Invalid survey input");
    return problemBadRequest(requestId, err.message, {
      invalid_params: [{ name: "body", reason: err.message }],
      instance,
    });
  }
  if (err instanceof V3SurveyInputValidationError) {
    // The document passed `ZV3CreateSurveyBody` but failed the survey service's stricter write
    // schema, caught by an explicit pre-write parse in `executeV3SurveyCreate`. Semantic, not
    // malformed → 422, in line with the reference-validation branch above. Deliberately keyed on
    // this typed error rather than on `ValidationError`: the latter is also thrown from work
    // `createSurvey` does *after* its transaction commits, where a 4xx would wrongly tell the
    // caller nothing was written. Those keep the 500 below.
    log.warn({ statusCode: 422, invalidParams: err.invalidParams }, "Survey input validation failed");
    return problemUnprocessableContent(requestId, "Survey document failed validation", {
      invalid_params: err.invalidParams,
      instance,
    });
  }
  if (err instanceof DatabaseError) {
    log.error({ error: err, statusCode: 500 }, "Database error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }

  log.error({ error: err, statusCode: 500 }, "V3 survey create unexpected error");
  return problemInternalError(requestId, "An unexpected error occurred.", instance);
}

export async function createV3SurveyResponse({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
  createdFrom,
  createOptions,
  authResult: providedAuthResult,
}: TCreateV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  try {
    const createBody = body;

    const authResult =
      providedAuthResult ??
      (await requireV3WorkspaceAccess(
        authentication,
        createBody.workspaceId,
        "readWrite",
        requestId,
        instance
      ));

    if (authResult instanceof Response) {
      return authResult;
    }

    const survey = await createV3Survey(
      {
        ...createBody,
        workspaceId: authResult.workspaceId,
      },
      authentication,
      requestId,
      authResult.organizationId,
      createOptions
    );
    const resource = serializeV3SurveyResource(survey);

    if (auditLog) {
      auditLog.organizationId = authResult.organizationId;
      auditLog.targetId = survey.id;
      auditLog.newObject = resource;
    }

    const sessionUserId = getSessionUserId(authentication);
    if (sessionUserId && createdFrom) {
      capturePostHogEvent(
        sessionUserId,
        "survey_created",
        {
          survey_id: survey.id,
          survey_type: survey.type,
          organization_id: authResult.organizationId,
          workspace_id: authResult.workspaceId,
          question_count: survey.questions?.length ?? 0,
          created_from: createdFrom,
        },
        { organizationId: authResult.organizationId, workspaceId: authResult.workspaceId }
      );
    }

    return createdResponse(resource, {
      requestId,
      location: `/api/v3/surveys/${survey.id}`,
    });
  } catch (err) {
    return mapV3SurveyCreateError(err, { log, requestId, instance });
  }
}

export async function createV3SurveyResponseFromRawInput({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TRawCreateV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId });
  const parsedBody = ZV3CreateSurveyBody.safeParse(body);

  if (!parsedBody.success) {
    const invalidParams = formatV3ZodInvalidParams(parsedBody.error, "body");
    log.warn({ statusCode: 400, invalidParams }, "Survey document validation failed");
    return problemBadRequest(requestId, "Invalid survey document", {
      invalid_params: invalidParams,
      instance,
    });
  }

  return await createV3SurveyResponse({
    body: parsedBody.data,
    authentication,
    requestId,
    instance,
    auditLog,
  });
}

export async function getV3Survey({
  surveyId,
  lang,
  authentication,
  requestId,
  instance,
}: TGetV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId });

  try {
    const { survey, response } = await getAuthorizedV3Survey({
      surveyId,
      authentication,
      access: "read",
      requestId,
      instance,
    });

    if (response) {
      log.warn({ statusCode: response.status }, "Survey not found or not accessible");
      return response;
    }

    try {
      return successResponse(serializeV3SurveyResource(survey, { lang }), {
        requestId,
        cache: "private, no-store",
      });
    } catch (error) {
      if (error instanceof V3SurveyLanguageError) {
        log.warn({ statusCode: 400, detail: error.message, lang }, "Invalid survey language selector");
        return problemBadRequest(requestId, error.message, {
          instance,
          invalid_params: [
            {
              name: "lang",
              reason: error.message,
              ...(error.normalizedCode && { identifier: error.normalizedCode }),
            },
          ],
        });
      }

      if (error instanceof V3SurveyUnsupportedShapeError) {
        log.warn({ statusCode: 400, detail: error.message }, "Unsupported v3 survey shape");
        return problemBadRequest(requestId, error.message, {
          instance,
          invalid_params: [
            {
              name: "survey",
              reason: error.message,
            },
          ],
        });
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      log.error({ error, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error, statusCode: 500 }, "V3 survey get unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

// Shared catch-block mapper for the single-survey mutation ops (delete/archive/restore): they share
// one error contract — not-found → 403, DatabaseError → 500, anything else → 500.
function mapV3SurveyMutationError(
  error: unknown,
  {
    log,
    requestId,
    instance,
    operation,
  }: { log: ReturnType<typeof logger.withContext>; requestId: string; instance: string; operation: string }
): Response {
  if (error instanceof ResourceNotFoundError) {
    log.warn({ errorCode: error.name, statusCode: 403 }, "Survey not found or not accessible");
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  if (error instanceof DatabaseError) {
    log.error({ error, statusCode: 500 }, "Database error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }

  log.error({ error, statusCode: 500 }, `V3 survey ${operation} unexpected error`);
  return problemInternalError(requestId, "An unexpected error occurred.", instance);
}

export async function deleteV3Survey({
  surveyId,
  authentication,
  requestId,
  instance,
  auditLog,
}: TV3SurveyMutationParams): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId });

  try {
    const { survey, authResult, response } = await getAuthorizedV3Survey({
      surveyId,
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });

    if (response) {
      log.warn({ statusCode: 403 }, "Survey not found or not accessible");
      return response;
    }

    if (auditLog) {
      auditLog.targetId = survey.id;
      auditLog.organizationId = authResult.organizationId;
      auditLog.oldObject = survey;
    }

    await deleteSurvey(surveyId);

    return noContentResponse({ requestId });
  } catch (error) {
    return mapV3SurveyMutationError(error, { log, requestId, instance, operation: "delete" });
  }
}

// archive and restore share the exact same flow (authorize readWrite → audit old → run the lifecycle
// service → audit new → return a minimal lifecycle ack); only the service and log label differ.
async function runV3SurveyLifecycleMutation(
  { surveyId, authentication, requestId, instance, auditLog }: TV3SurveyMutationParams,
  {
    operation,
    mutate,
  }: {
    operation: "archive" | "restore";
    mutate: (id: string) => Promise<{ id: string; status: string; archivedAt: Date | null }>;
  }
): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId });

  try {
    const { survey, authResult, response } = await getAuthorizedV3Survey({
      surveyId,
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });

    if (response) {
      log.warn({ statusCode: 403 }, "Survey not found or not accessible");
      return response;
    }

    if (auditLog) {
      auditLog.targetId = survey.id;
      auditLog.organizationId = authResult.organizationId;
      auditLog.oldObject = survey;
    }

    const mutatedSurvey = await mutate(surveyId);

    if (auditLog) {
      auditLog.newObject = mutatedSurvey;
    }

    // Intentional lifecycle ack, not the full document resource: archive/restore operate on any
    // survey (incl. legacy question-based ones that serializeV3SurveyResource rejects), so we return
    // an explicit minimal shape rather than leaking the raw Prisma object or blocking those surveys.
    const ack = {
      id: mutatedSurvey.id,
      status: mutatedSurvey.status,
      archivedAt: mutatedSurvey.archivedAt,
    };
    return successResponse(ack, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3SurveyMutationError(error, { log, requestId, instance, operation });
  }
}

export async function archiveV3Survey(params: TV3SurveyMutationParams): Promise<Response> {
  return runV3SurveyLifecycleMutation(params, { operation: "archive", mutate: archiveSurvey });
}

export async function restoreV3Survey(params: TV3SurveyMutationParams): Promise<Response> {
  return runV3SurveyLifecycleMutation(params, { operation: "restore", mutate: restoreSurvey });
}

/**
 * Map an error thrown during survey patch to its problem+json Response. Extracted from
 * patchV3SurveyResponse to keep that handler's cognitive complexity within bounds.
 */
function mapV3SurveyPatchError(
  err: unknown,
  {
    log,
    requestId,
    instance,
    workspaceId,
  }: {
    log: ReturnType<typeof logger.withContext>;
    requestId: string;
    instance: string;
    workspaceId: string | undefined;
  }
): Response {
  if (err instanceof V3SurveyReferenceValidationError) {
    // Semantic/reference validation failure on a well-formed document → 422 (see create handler).
    log.warn(
      { statusCode: 422, workspaceId, invalidParamCount: err.invalidParams.length },
      "Survey document validation failed"
    );
    return problemUnprocessableContent(requestId, "Survey document failed validation", {
      invalid_params: err.invalidParams,
      instance,
    });
  }

  if (err instanceof V3SurveyUnsupportedShapeError) {
    log.warn({ statusCode: 400, workspaceId, errorCode: err.name }, "Unsupported v3 survey shape");
    return problemBadRequest(requestId, err.message, {
      instance,
      invalid_params: [{ name: "survey", reason: err.message }],
    });
  }

  if (err instanceof V3SurveyWritePermissionError) {
    log.warn({ statusCode: 403, workspaceId, errorCode: err.name }, "Survey patch permission check failed");
    return problemForbidden(requestId, err.message, instance);
  }

  if (err instanceof V3SurveyStoredDocumentError) {
    log.warn(
      { statusCode: 422, workspaceId, invalidParamCount: err.invalidParams.length },
      "Stored survey does not satisfy the v3 document contract"
    );
    return problemUnprocessableContent(
      requestId,
      "The stored survey does not satisfy the v3 survey document contract, so this request was not evaluated. The reported paths are into the stored survey, not your request; repair them in the editor.",
      {
        code: "stored_survey_invalid",
        invalid_params: err.invalidParams,
        instance,
      }
    );
  }

  if (err instanceof V3SurveyStaleError) {
    const currentUpdatedAt = err.currentUpdatedAt.toISOString();
    log.warn(
      {
        statusCode: 409,
        workspaceId,
        expectedUpdatedAt: err.expectedUpdatedAt.toISOString(),
        currentUpdatedAt,
        // "read" means the pre-flight caught it; "write" means the compare-and-set did, i.e. a real
        // race inside the request. Worth being able to tell apart in production.
        staleDetectedAt: err.detectedAt,
      },
      "Survey precondition failed"
    );
    return problemConflict(
      requestId,
      `Survey was modified since it was last read; updatedAt is now ${currentUpdatedAt}. Re-read the survey and retry.`,
      instance,
      {
        details: {
          expectedUpdatedAt: err.expectedUpdatedAt.toISOString(),
          currentUpdatedAt,
        },
      }
    );
  }

  if (err instanceof ResourceNotFoundError) {
    log.warn({ errorCode: err.name, workspaceId, statusCode: 403 }, "Survey not found or not accessible");
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  if (err instanceof InvalidInputError) {
    log.warn({ errorCode: err.name, workspaceId, statusCode: 400 }, "Invalid survey input");
    return problemBadRequest(requestId, err.message, {
      invalid_params: [{ name: "body", reason: err.message }],
      instance,
    });
  }

  if (err instanceof DatabaseError) {
    log.error({ error: err, workspaceId, statusCode: 500 }, "Database error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }

  log.error({ error: err, workspaceId, statusCode: 500 }, "V3 survey patch unexpected error");
  return problemInternalError(requestId, "An unexpected error occurred.", instance);
}

/**
 * What a document mutation wants written, decided against the authorized survey (ENG-3069).
 *
 * `unchanged` exists so an idempotent no-op — reordering blocks into the order they are already in —
 * can skip the write entirely. Otherwise it would bump `updatedAt` and spuriously invalidate every
 * other caller's precondition, which would make the reorder endpoint's idempotence a lie.
 */
type TV3SurveyDocumentMutationInput =
  | {
      ok: true;
      input: unknown;
      logFields?: Record<string, unknown>;
      remapInvalidParam?: (param: InvalidParam) => InvalidParam;
    }
  | { ok: true; unchanged: true; logFields?: Record<string, unknown> }
  | { ok: false; detail: string; invalidParams: InvalidParam[]; logFields?: Record<string, unknown> };

type TV3SurveyDocumentMutationParams = TPatchV3SurveyParams & {
  operation: "patch" | "blocks.edit" | "blocks.reorder";
  precondition?: TV3SurveyWritePrecondition;
  buildInput: (ctx: {
    survey: TInternalSurvey;
    getResource: () => ReturnType<typeof serializeV3SurveyResource>;
  }) => TV3SurveyDocumentMutationInput;
};

/**
 * The one write path for every v3 survey-document mutation: PATCH, block edits and block reorder.
 *
 * They differ only in how they turn the stored survey into a patch payload, which is what
 * `buildInput` supplies. Everything security-relevant — authorization, the archived and legacy
 * guards, entitlement checks inside patchV3Survey, audit enrichment, error mapping — happens here
 * once, so a new operation cannot accidentally ship without it.
 */
async function runV3SurveyDocumentMutation({
  surveyId,
  authentication,
  requestId,
  instance,
  auditLog,
  operation,
  precondition,
  buildInput,
}: TV3SurveyDocumentMutationParams): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId, operation });
  let workspaceId: string | undefined;
  let remapInvalidParam: ((param: InvalidParam) => InvalidParam) | undefined;

  try {
    const { survey, authResult, response } = await getAuthorizedV3Survey({
      surveyId,
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });

    if (response) {
      log.warn({ statusCode: response.status }, "Survey not found or not accessible");
      return response;
    }

    workspaceId = survey.workspaceId;

    // Archived surveys are read-only. Editing (esp. flipping status back to inProgress) would let an
    // archived survey collect responses while it is queued for permanent deletion. Require restore first.
    // archivedAt is already loaded on `survey` (selectSurvey includes it), so no extra query — and reading
    // it from the same fetch the auth check used avoids a restore-between-reads TOCTOU.
    if (survey.archivedAt) {
      log.warn({ statusCode: 422, workspaceId }, "Attempted to patch an archived survey");
      return problemUnprocessableContent(requestId, "Survey is archived", {
        instance,
        invalid_params: [
          {
            name: "archivedAt",
            reason: "This survey is archived. Restore it before editing.",
          },
        ],
      });
    }

    // Legacy question-based surveys have no v3 block list. Without this the block endpoints would
    // reach the serializer, throw V3SurveyUnsupportedShapeError and answer 400 — attributing a
    // property of the stored survey to the caller's request, and contradicting the 422
    // `stored_survey_invalid` the contract documents. PATCH already reports it that way via prepare.
    if (Array.isArray(survey.questions) && survey.questions.length > 0) {
      log.warn({ statusCode: 422, workspaceId }, "Legacy question-based survey is not v3-editable");
      return problemUnprocessableContent(
        requestId,
        "The stored survey does not satisfy the v3 survey document contract, so this request was not evaluated. Legacy question-based surveys are not supported by the v3 survey management API.",
        {
          code: "stored_survey_invalid",
          instance,
          invalid_params: [
            {
              name: "survey",
              reason: "Legacy question-based surveys are not supported by the v3 survey management API",
            },
          ],
        }
      );
    }

    // Serialized lazily: PATCH must not pay for it, and a legacy question-based survey would throw
    // out of the serializer as a 400 here instead of the 422 the prepare step already gives it.
    let cachedResource: ReturnType<typeof serializeV3SurveyResource> | undefined;
    const getResource = (): ReturnType<typeof serializeV3SurveyResource> => {
      cachedResource ??= serializeV3SurveyResource(survey);
      return cachedResource;
    };

    const built = buildInput({ survey, getResource });

    if (!built.ok) {
      log.warn(
        { statusCode: 422, workspaceId, invalidParamCount: built.invalidParams.length, ...built.logFields },
        "Survey document mutation rejected"
      );
      return problemUnprocessableContent(requestId, built.detail, {
        instance,
        invalid_params: built.invalidParams,
      });
    }

    if ("unchanged" in built) {
      const resource = getResource();
      if (auditLog) {
        auditLog.targetId = survey.id;
        auditLog.organizationId = authResult.organizationId;
        auditLog.oldObject = resource;
        auditLog.newObject = resource;
      }
      log.info(
        { statusCode: 200, workspaceId, wrote: false, ...built.logFields },
        "Survey document unchanged"
      );
      return successResponse(resource, { requestId, cache: "private, no-store" });
    }

    remapInvalidParam = built.remapInvalidParam;
    const oldResource = getResource();

    const updatedSurvey = await patchV3Survey(
      survey,
      built.input,
      requestId,
      authResult.organizationId,
      precondition
    );
    const resource = serializeV3SurveyResource(updatedSurvey);

    if (auditLog) {
      auditLog.targetId = updatedSurvey.id;
      auditLog.organizationId = authResult.organizationId;
      auditLog.oldObject = oldResource;
      auditLog.newObject = resource;
    }

    log.info(
      {
        statusCode: 200,
        workspaceId,
        wrote: true,
        precondition: precondition ? "matched" : "none",
        ...built.logFields,
      },
      "Survey document updated"
    );

    return successResponse(resource, {
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    // A block op produced this document, so `blocks.<i>` paths name an array the caller never sent.
    // Rewrite the ones that belong to an op before the error leaves the building.
    if (remapInvalidParam && error instanceof V3SurveyReferenceValidationError) {
      return mapV3SurveyPatchError(
        new V3SurveyReferenceValidationError(error.invalidParams.map(remapInvalidParam)),
        { log, requestId, instance, workspaceId }
      );
    }
    return mapV3SurveyPatchError(error, { log, requestId, instance, workspaceId });
  }
}

export async function patchV3SurveyResponse({ body, ...params }: TPatchV3SurveyParams): Promise<Response> {
  return runV3SurveyDocumentMutation({
    ...params,
    body,
    operation: "patch",
    buildInput: () => ({
      ok: true,
      input: body,
      logFields: {
        patchedFields: isPlainObjectBody(body) ? Object.keys(body) : undefined,
      },
    }),
  });
}

function isPlainObjectBody(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function editV3SurveyBlocksResponse({
  body,
  ...params
}: TPatchV3SurveyParams): Promise<Response> {
  const parsed = ZV3EditSurveyBlocksBody.safeParse(body);
  if (!parsed.success) {
    return problemBadRequest(params.requestId, "Invalid request body", {
      instance: params.instance,
      invalid_params: formatV3ZodInvalidParams(parsed.error, "body"),
    });
  }

  const { ops, expectedUpdatedAt } = parsed.data;

  return runV3SurveyDocumentMutation({
    ...params,
    body,
    operation: "blocks.edit",
    ...(expectedUpdatedAt ? { precondition: { expectedUpdatedAt: new Date(expectedUpdatedAt) } } : {}),
    buildInput: ({ getResource }) => {
      const currentBlocks = readPublicBlocks(getResource());
      if (!currentBlocks) {
        return {
          ok: false,
          detail: "This survey's blocks cannot be edited through the v3 API",
          invalidParams: [
            {
              name: "blocks",
              reason: "The stored survey does not expose a v3 block list.",
            },
          ],
        };
      }

      const result = applySurveyBlockOperations(currentBlocks, ops);
      if (!result.ok) {
        return {
          ok: false,
          detail: "Block operations could not be applied",
          invalidParams: result.invalidParams,
          logFields: { ...result.summary, failedOpIndex: result.failedOpIndex },
        };
      }

      return {
        ok: true,
        input: { blocks: result.blocks },
        logFields: { ...result.summary, blockCount: result.blocks.length },
        remapInvalidParam: (param) => remapBlockInvalidParamPath(param, result.originOpIndexByBlockIndex),
      };
    },
  });
}

export async function setV3SurveyBlockOrderResponse({
  body,
  ...params
}: TPatchV3SurveyParams): Promise<Response> {
  const parsed = ZV3SetSurveyBlockOrderBody.safeParse(body);
  if (!parsed.success) {
    return problemBadRequest(params.requestId, "Invalid request body", {
      instance: params.instance,
      invalid_params: formatV3ZodInvalidParams(parsed.error, "body"),
    });
  }

  const { order, expectedUpdatedAt } = parsed.data;

  return runV3SurveyDocumentMutation({
    ...params,
    body,
    operation: "blocks.reorder",
    ...(expectedUpdatedAt ? { precondition: { expectedUpdatedAt: new Date(expectedUpdatedAt) } } : {}),
    buildInput: ({ getResource }) => {
      const currentBlocks = readPublicBlocks(getResource());
      if (!currentBlocks) {
        return {
          ok: false,
          detail: "This survey's blocks cannot be reordered through the v3 API",
          invalidParams: [{ name: "order", reason: "The stored survey does not expose a v3 block list." }],
        };
      }

      const result = reorderSurveyBlocks(currentBlocks, order);
      if (!result.ok) {
        return {
          ok: false,
          detail: "Block order must list every block exactly once",
          invalidParams: result.invalidParams,
          logFields: { blockCount: currentBlocks.length },
        };
      }

      if (result.unchanged) {
        return { ok: true, unchanged: true, logFields: { blockCount: result.blocks.length } };
      }

      return {
        ok: true,
        input: { blocks: result.blocks },
        logFields: { blockCount: result.blocks.length },
      };
    },
  });
}

/**
 * Dry-run validation of a create or patch payload. Neither branch writes: the create branch is a
 * pure function of the input, and the patch branch merges the payload into the loaded survey in
 * memory. Both are therefore gated at `read`, not `readWrite`.
 *
 * That level is load-bearing for the MCP `validate_survey` tool, which is registered `surveys:read`
 * (and annotated `readOnlyHint`). Requiring write here made a read-scoped agent 403 on a tool that
 * mutates nothing (ENG-2179). If this is ever raised back to `readWrite`, that tool's declared scope
 * has to move with it.
 */
export async function validateV3Survey({
  body,
  authentication,
  requestId,
  instance,
}: TValidateV3SurveyParams): Promise<Response> {
  let log = logger.withContext({
    requestId,
    ...(body.operation === "patch" ? { surveyId: body.surveyId } : {}),
  });

  try {
    const validationBody = body;
    if (validationBody.operation === "create") {
      const workspaceResult = createWorkspaceIdSchema.safeParse(validationBody.data);
      if (workspaceResult.success) {
        log = logger.withContext({ requestId, workspaceId: workspaceResult.data.workspaceId });
        const authResult = await requireV3WorkspaceAccess(
          authentication,
          workspaceResult.data.workspaceId,
          "read",
          requestId,
          instance
        );

        if (authResult instanceof Response) {
          return authResult;
        }
      }

      return successResponse(
        serializeValidationResult("create", prepareV3SurveyCreateInput(validationBody.data)),
        {
          requestId,
          cache: "private, no-store",
        }
      );
    }

    const { survey, response } = await getAuthorizedV3Survey({
      surveyId: validationBody.surveyId,
      authentication,
      access: "read",
      requestId,
      instance,
    });

    if (response) {
      log.warn(
        { statusCode: response.status, surveyId: validationBody.surveyId },
        "Survey not found or not accessible"
      );
      return response;
    }

    log = logger.withContext({
      requestId,
      surveyId: validationBody.surveyId,
      workspaceId: survey.workspaceId,
    });

    return successResponse(
      serializeValidationResult("patch", prepareV3SurveyPatchInput(survey, validationBody.data)),
      {
        requestId,
        cache: "private, no-store",
      }
    );
  } catch (error) {
    if (error instanceof DatabaseError) {
      log.error({ error, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error, statusCode: 500 }, "V3 survey validation unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

export async function validateV3SurveyFromRawInput({
  body,
  authentication,
  requestId,
  instance,
}: TRawValidateV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId });
  const parsedBody = ZV3SurveyValidationRequestBody.safeParse(body);

  if (!parsedBody.success) {
    const invalidParams = formatV3ZodInvalidParams(parsedBody.error, "body");
    log.warn({ statusCode: 400, invalidParams }, "Survey validation request failed");
    return problemBadRequest(requestId, "Invalid survey validation request", {
      invalid_params: invalidParams,
      instance,
    });
  }

  return await validateV3Survey({
    body: parsedBody.data,
    authentication,
    requestId,
    instance,
  });
}
