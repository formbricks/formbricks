import { ZodError, type z } from "zod";
import { buildV3Headers } from "./http";
import type { WorkflowsLogger } from "./services/ports";

/**
 * Typed domain errors thrown by the workflow service/handlers, plus a single mapper to
 * RFC 9457 `application/problem+json` responses. The mapper is the one place that logs
 * mapped errors (`.warn` for 4xx, `.error` for 5xx) so every error is logged exactly once,
 * with the request-bound logger. Web-standard `Response` keeps this framework-agnostic.
 *
 * Codes and body shape mirror `apps/web/app/api/v3/lib/response.ts` so workflow problems are
 * indistinguishable from the rest of the v3 API.
 */

export type WorkflowProblemCode =
  | "bad_request"
  | "forbidden"
  | "conflict"
  | "unprocessable_content"
  | "internal_server_error";

export interface WorkflowInvalidParam {
  name: string;
  reason: string;
}

const PROBLEM_JSON = "application/problem+json";

const TITLE_BY_STATUS: Record<number, string> = {
  400: "Bad Request",
  403: "Forbidden",
  409: "Conflict",
  422: "Unprocessable Content",
  500: "Internal Server Error",
};

/** Base class for all expected workflow API failures. */
export abstract class WorkflowApiError extends Error {
  abstract readonly status: number;
  abstract readonly code: WorkflowProblemCode;
  readonly invalidParams?: WorkflowInvalidParam[];

  constructor(message: string, invalidParams?: WorkflowInvalidParam[]) {
    super(message);
    this.name = new.target.name;
    this.invalidParams = invalidParams;
  }
}

/** 403 for unknown / cross-workspace resources — deliberately not 404, to avoid leaking existence. */
export class WorkflowForbiddenError extends WorkflowApiError {
  readonly status = 403;
  readonly code = "forbidden" as const;

  constructor(message = "You are not authorized to access this resource") {
    super(message);
  }
}

/** 400 for malformed input or a definition that fails schema validation. */
export class WorkflowInvalidInputError extends WorkflowApiError {
  readonly status = 400;
  readonly code = "bad_request" as const;
}

/**
 * 409 for write conflicts (e.g. a future workspace-unique-name constraint). Not currently thrown in
 * Scope 1 — the `Workflow` model has no unique constraint beyond `(id, workspaceId)` — but kept so
 * ENG-1222/1223 reuse the same mapper.
 */
export class WorkflowConflictError extends WorkflowApiError {
  readonly status = 409;
  readonly code = "conflict" as const;

  constructor(message = "The request conflicts with the current state of the resource") {
    super(message);
  }
}

/**
 * 500 when a serialized response fails its own resource-schema validation — a server bug, never the
 * caller's fault. The underlying `ZodError` is attached for logging; the client sees a generic 500.
 */
export class WorkflowSerializationError extends WorkflowApiError {
  readonly status = 500;
  readonly code = "internal_server_error" as const;
  readonly cause: ZodError;

  constructor(cause: ZodError) {
    super("Workflow response failed output validation");
    this.cause = cause;
  }
}

/**
 * Validate a serialized response against its resource schema before returning it. A mismatch is a
 * server bug, not caller input, so it surfaces as a `WorkflowSerializationError` (→ logged 500).
 */
export const validateOutput = <S extends z.ZodType>(schema: S, value: unknown): z.infer<S> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new WorkflowSerializationError(result.error);
  }
  return result.data;
};

const invalidParamsFromZodError = (error: ZodError): WorkflowInvalidParam[] =>
  error.issues.map((issue) => ({
    name: issue.path.map(String).join("."),
    reason: issue.message,
  }));

const problemResponse = (
  status: number,
  detail: string,
  options: {
    requestId: string;
    code: string;
    instance?: string;
    invalidParams?: WorkflowInvalidParam[];
  }
): Response => {
  const body = {
    title: TITLE_BY_STATUS[status] ?? "Error",
    status,
    detail,
    requestId: options.requestId,
    code: options.code,
    ...(options.instance ? { instance: options.instance } : {}),
    ...(options.invalidParams ? { invalid_params: options.invalidParams } : {}),
  };

  return Response.json(body, {
    status,
    headers: buildV3Headers(PROBLEM_JSON, options.requestId),
  });
};

interface ProblemContext {
  requestId: string;
  instance?: string;
  logger: WorkflowsLogger;
}

/**
 * Map any thrown error to a problem response and log it. `ZodError` (e.g. from a contract
 * `.parse`) becomes a 400 with `invalid_params`; known `WorkflowApiError`s use their own
 * status/code; anything else is a logged 500 with a generic detail (no internals leaked).
 */
export const toProblemResponse = (error: unknown, ctx: ProblemContext): Response => {
  if (error instanceof ZodError) {
    const invalidParams = invalidParamsFromZodError(error);
    ctx.logger.warn({ statusCode: 400, invalidParams }, "Workflow request validation failed");
    return problemResponse(400, "The request payload is invalid.", {
      requestId: ctx.requestId,
      code: "bad_request",
      instance: ctx.instance,
      invalidParams,
    });
  }

  if (error instanceof WorkflowApiError) {
    if (error.status >= 500) {
      // Log the real cause, but never leak internals (e.g. serialization issues) to the client.
      ctx.logger.error({ error, statusCode: error.status }, error.message);
      return problemResponse(error.status, "An unexpected error occurred.", {
        requestId: ctx.requestId,
        code: error.code,
        instance: ctx.instance,
      });
    }
    ctx.logger.warn({ statusCode: error.status, code: error.code }, error.message);
    return problemResponse(error.status, error.message, {
      requestId: ctx.requestId,
      code: error.code,
      instance: ctx.instance,
      invalidParams: error.invalidParams,
    });
  }

  ctx.logger.error({ error, statusCode: 500 }, "Unexpected workflow API error");
  return problemResponse(500, "An unexpected error occurred.", {
    requestId: ctx.requestId,
    code: "internal_server_error",
    instance: ctx.instance,
  });
};
