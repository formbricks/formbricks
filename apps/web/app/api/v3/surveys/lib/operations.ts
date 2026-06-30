import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { capturePostHogEvent } from "@/lib/posthog";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";
import { getAuthorizedV3Survey } from "../authorization";
import { type TV3SurveyCreateOptions, V3SurveyCreatePermissionError, createV3Survey } from "../create";
import { parseV3SurveysListQuery } from "../parse-v3-surveys-list-query";
import { patchV3Survey } from "../patch";
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
  createdFrom?: "blank" | "template" | "xm-template";
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

type TDeleteV3SurveyParams = {
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

function getSessionUserId(authentication: TV3Authentication): string | null {
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
    const totalCountPromise = parsed.includeTotalCount
      ? getSurveyCount(workspaceId, parsed.filterCriteria)
      : Promise.resolve(null);
    const [surveyPage, totalCount] = await Promise.all([surveyPagePromise, totalCountPromise]);

    return successListResponse(
      surveyPage.surveys.map(serializeV3SurveyListItem),
      {
        limit: parsed.limit,
        nextCursor: surveyPage.nextCursor,
        totalCount,
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

export async function deleteV3Survey({
  surveyId,
  authentication,
  requestId,
  instance,
  auditLog,
}: TDeleteV3SurveyParams): Promise<Response> {
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
    if (error instanceof ResourceNotFoundError) {
      log.warn({ errorCode: error.name, statusCode: 403 }, "Survey not found or not accessible");
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }

    if (error instanceof DatabaseError) {
      log.error({ error, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error, statusCode: 500 }, "V3 survey delete unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

export async function patchV3SurveyResponse({
  surveyId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TPatchV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId });
  let workspaceId: string | undefined;

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
    const updatedSurvey = await patchV3Survey(survey, body, requestId, authResult.organizationId);
    const resource = serializeV3SurveyResource(updatedSurvey);

    if (auditLog) {
      auditLog.targetId = updatedSurvey.id;
      auditLog.organizationId = authResult.organizationId;
      auditLog.oldObject = serializeV3SurveyResource(survey);
      auditLog.newObject = resource;
    }

    return successResponse(resource, {
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    if (error instanceof V3SurveyReferenceValidationError) {
      // Semantic/reference validation failure on a well-formed document → 422 (see create handler).
      log.warn(
        { statusCode: 422, workspaceId, invalidParamCount: error.invalidParams.length },
        "Survey document validation failed"
      );
      return problemUnprocessableContent(requestId, "Survey document failed validation", {
        invalid_params: error.invalidParams,
        instance,
      });
    }

    if (error instanceof V3SurveyUnsupportedShapeError) {
      log.warn({ statusCode: 400, workspaceId, errorCode: error.name }, "Unsupported v3 survey shape");
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

    if (error instanceof V3SurveyWritePermissionError) {
      log.warn(
        { statusCode: 403, workspaceId, errorCode: error.name },
        "Survey patch permission check failed"
      );
      return problemForbidden(requestId, error.message, instance);
    }

    if (error instanceof ResourceNotFoundError) {
      log.warn({ errorCode: error.name, workspaceId, statusCode: 403 }, "Survey not found or not accessible");
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }

    if (error instanceof InvalidInputError) {
      log.warn({ errorCode: error.name, workspaceId, statusCode: 400 }, "Invalid survey input");
      return problemBadRequest(requestId, error.message, {
        invalid_params: [{ name: "body", reason: error.message }],
        instance,
      });
    }

    if (error instanceof DatabaseError) {
      log.error({ error, workspaceId, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error, workspaceId, statusCode: 500 }, "V3 survey patch unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

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
          "readWrite",
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
      access: "readWrite",
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
