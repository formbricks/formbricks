import { NextResponse } from "next/server";
import { logger } from "@formbricks/logger";
import {
  AuthenticationError,
  AuthorizationError,
  InvalidInputError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { problemForbidden, problemTooManyRequests } from "@/app/api/v3/lib/response";
import { getCrossOriginRefusal } from "@/app/lib/api/origin-check";
import { RequestBodyTooLargeError, parseFormDataWithLimit } from "@/app/lib/api/request-body";
import { assertCan } from "@/lib/authorization";
import { assertFeedbackSourceDirectoryAccess } from "@/lib/feedback-source/access";
import { CsvImportValidationError, importCsvFile } from "@/lib/feedback-source/csv-file-import";
import { getFeedbackSourceWithMappingsById } from "@/lib/feedback-source/service";
import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  CSV_FILE_TOO_LARGE_ERROR_CODE,
  CSV_IMPORT_FAILED_ERROR_CODE,
  MAX_CSV_VALUES,
} from "@/modules/ee/unify-feedback/sources/types";

const CSV_IMPORT_REQUEST_BODY_LIMIT = MAX_CSV_VALUES.FILE_SIZE + 1024 * 1024;

const getContentLength = (headers: Headers): number | null => {
  const contentLength = headers.get("content-length");
  if (!contentLength) return null;

  const parsed = Number(contentLength);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const getStringFormValue = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
};

const getCsvFile = (formData: FormData): File | null => {
  const file = formData.get("file");
  return file instanceof File ? file : null;
};

const buildCsvImportErrorResponse = (
  error: string,
  status: number,
  details: { row?: number; max?: number } = {}
) => NextResponse.json({ error, ...details }, { status });

const buildFileTooLargeResponse = () =>
  buildCsvImportErrorResponse(CSV_FILE_TOO_LARGE_ERROR_CODE, 413, { max: MAX_CSV_VALUES.FILE_SIZE });

/**
 * Bounded while reading, not just by the `Content-Length` header: a chunked upload carries no header,
 * and the patched Next no longer cuts any body off for us (ENG-3972). A too-large body propagates as
 * `RequestBodyTooLargeError` for `mapImportError`.
 */
const readUpload = async (request: Request) => {
  let formData: FormData;
  try {
    formData = await parseFormDataWithLimit(request, CSV_IMPORT_REQUEST_BODY_LIMIT);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new InvalidInputError("Malformed form data");
  }

  const workspaceId = getStringFormValue(formData, "workspaceId");
  const feedbackSourceId = getStringFormValue(formData, "feedbackSourceId");
  const file = getCsvFile(formData);

  if (!workspaceId || !feedbackSourceId || !file) {
    throw new InvalidInputError("workspaceId, feedbackSourceId, and file are required");
  }

  return { workspaceId, feedbackSourceId, file };
};

/**
 * The signed-in user, or the authentication or authorization error the route maps to 401 or 403. The
 * per-user rate limit runs as soon as the session is known, before any database read.
 */
const getSessionUser = async () => {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }

  await applyRateLimit(rateLimitConfigs.api.internalFeedbackCsvImport, session.user.id);

  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthorizationError("User not found");
  }
  return user;
};

const assertCanImport = async (userId: string, workspaceId: string, feedbackSourceId: string) => {
  await assertCan({ type: "user", id: userId }, "workspace.write", { type: "workspace", id: workspaceId });

  const feedbackSource = await getFeedbackSourceWithMappingsById(feedbackSourceId, workspaceId);
  if (!feedbackSource) {
    throw new ResourceNotFoundError("FeedbackSource", feedbackSourceId);
  }
  await assertFeedbackSourceDirectoryAccess(userId, feedbackSource.feedbackDirectoryId, workspaceId, "write");
};

const mapImportError = (error: unknown, requestId: string): Response => {
  if (error instanceof CsvImportValidationError) {
    return buildCsvImportErrorResponse(error.code, error.code === CSV_FILE_TOO_LARGE_ERROR_CODE ? 413 : 400, {
      row: error.row,
      max: error.max,
    });
  }
  if (error instanceof RequestBodyTooLargeError) return buildFileTooLargeResponse();
  if (error instanceof TooManyRequestsError) {
    return problemTooManyRequests(requestId, error.message, error.retryAfter);
  }
  if (error instanceof AuthenticationError) return buildCsvImportErrorResponse(error.message, 401);
  if (error instanceof AuthorizationError) return buildCsvImportErrorResponse(error.message, 403);
  if (error instanceof InvalidInputError || error instanceof ResourceNotFoundError) {
    return buildCsvImportErrorResponse(error.message, 400);
  }

  logger.error(
    { errorName: error instanceof Error ? error.name : "unknown" },
    "Failed to import CSV feedback source data"
  );
  return buildCsvImportErrorResponse(CSV_IMPORT_FAILED_ERROR_CODE, 500);
};

/**
 * Session-cookie auth outside `withV3ApiWrapper`, and `multipart/form-data` needs no CORS preflight, so
 * `SameSite=Lax` is the only thing keeping a sibling subdomain from posting here with the victim's
 * session (ENG-3380). The wrapper's cross-origin check runs first, before anything is read. The two
 * refusals this route adds (403, 429) use the house RFC 9457 problem shape; the import's own result and
 * validation errors keep their `{ error, row, max }` body, which the CSV modal reads.
 */
export const POST = async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const refusal = getCrossOriginRefusal(request);
    if (refusal) {
      logger.warn({ requestId, refusal, statusCode: 403 }, "CSV import cross-origin request refused");
      return problemForbidden(requestId, "Cross-origin request refused", new URL(request.url).pathname);
    }

    const contentLength = getContentLength(request.headers);
    if (contentLength !== null && contentLength > CSV_IMPORT_REQUEST_BODY_LIMIT) {
      return buildFileTooLargeResponse();
    }

    const user = await getSessionUser();

    const { workspaceId, feedbackSourceId, file } = await readUpload(request);
    await assertCanImport(user.id, workspaceId, feedbackSourceId);

    return NextResponse.json(await importCsvFile({ feedbackSourceId, workspaceId, file }));
  } catch (error) {
    return mapImportError(error, requestId);
  }
};
