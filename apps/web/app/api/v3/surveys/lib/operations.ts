import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";
import { getAuthorizedV3Survey } from "../authorization";
import { V3SurveyCreatePermissionError, createV3Survey } from "../create";
import { parseV3SurveysListQuery } from "../parse-v3-surveys-list-query";
import {
  type TV3SurveyPrepareResult,
  prepareV3SurveyCreateInput,
  prepareV3SurveyPatchInput,
} from "../prepare";
import { V3SurveyReferenceValidationError } from "../reference-validation";
import type { TV3CreateSurveyBody, TV3SurveyDocument, TV3SurveyValidationRequestBody } from "../schemas";
import {
  V3SurveyLanguageError,
  V3SurveyUnsupportedShapeError,
  serializeV3SurveyListItem,
  serializeV3SurveyResource,
} from "../serializers";

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

type TValidateV3SurveyParams = {
  body: TV3SurveyValidationRequestBody;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

const createWorkspaceIdSchema = z.object({
  workspaceId: z.cuid2(),
});

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

export async function createV3SurveyResponse({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TCreateV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  try {
    const authResult = await requireV3WorkspaceAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return authResult;
    }

    const survey = await createV3Survey(
      {
        ...body,
        workspaceId: authResult.workspaceId,
      },
      authentication,
      requestId,
      authResult.organizationId
    );
    const resource = serializeV3SurveyResource(survey);

    if (auditLog) {
      auditLog.organizationId = authResult.organizationId;
      auditLog.targetId = survey.id;
      auditLog.newObject = resource;
    }

    return createdResponse(resource, {
      requestId,
      location: `/api/v3/surveys/${survey.id}`,
    });
  } catch (err) {
    if (err instanceof V3SurveyReferenceValidationError) {
      log.warn({ statusCode: 400, invalidParams: err.invalidParams }, "Survey document validation failed");
      return problemBadRequest(requestId, "Invalid survey document", {
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
    if (err instanceof DatabaseError) {
      log.error({ error: err, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error: err, statusCode: 500 }, "V3 survey create unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
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

export async function validateV3Survey({
  body,
  authentication,
  requestId,
  instance,
}: TValidateV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId, operation: body.operation });

  try {
    if (body.operation === "create") {
      const workspaceResult = createWorkspaceIdSchema.safeParse(body.data);
      if (workspaceResult.success) {
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

      return successResponse(serializeValidationResult("create", prepareV3SurveyCreateInput(body.data)), {
        requestId,
        cache: "private, no-store",
      });
    }

    const { survey, response } = await getAuthorizedV3Survey({
      surveyId: body.surveyId,
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });

    if (response) {
      log.warn({ statusCode: response.status, surveyId: body.surveyId }, "Survey not found or not accessible");
      return response;
    }

    return successResponse(
      serializeValidationResult("patch", prepareV3SurveyPatchInput(survey, body.data)),
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
