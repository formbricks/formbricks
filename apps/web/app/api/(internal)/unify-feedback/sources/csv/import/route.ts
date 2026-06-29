import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { logger } from "@formbricks/logger";
import {
  AuthenticationError,
  AuthorizationError,
  InvalidInputError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { CsvImportValidationError, importCsvFile } from "@/lib/feedback-source/csv-file-import";
import { getUser } from "@/lib/user/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromFeedbackSourceId } from "@/lib/utils/helper";
import { authOptions } from "@/modules/auth/lib/authOptions";
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

export const POST = async (request: Request) => {
  try {
    const contentLength = getContentLength(request.headers);
    if (contentLength !== null && contentLength > CSV_IMPORT_REQUEST_BODY_LIMIT) {
      return buildCsvImportErrorResponse(CSV_FILE_TOO_LARGE_ERROR_CODE, 413, {
        max: MAX_CSV_VALUES.FILE_SIZE,
      });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new AuthenticationError("Not authenticated");
    }

    const user = await getUser(session.user.id);
    if (!user) {
      throw new AuthorizationError("User not found");
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new InvalidInputError("Malformed form data");
    }

    const workspaceId = getStringFormValue(formData, "workspaceId");
    const feedbackSourceId = getStringFormValue(formData, "feedbackSourceId");
    const file = getCsvFile(formData);

    if (!workspaceId || !feedbackSourceId || !file) {
      throw new InvalidInputError("workspaceId, feedbackSourceId, and file are required");
    }

    const organizationId = await getOrganizationIdFromFeedbackSourceId(feedbackSourceId);
    await checkAuthorizationUpdated({
      userId: user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId,
        },
      ],
    });

    const result = await importCsvFile({ feedbackSourceId, workspaceId, file });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CsvImportValidationError) {
      return buildCsvImportErrorResponse(
        error.code,
        error.code === CSV_FILE_TOO_LARGE_ERROR_CODE ? 413 : 400,
        {
          row: error.row,
          max: error.max,
        }
      );
    }

    if (error instanceof AuthenticationError) {
      return buildCsvImportErrorResponse(error.message, 401);
    }

    if (error instanceof AuthorizationError) {
      return buildCsvImportErrorResponse(error.message, 403);
    }

    if (error instanceof InvalidInputError || error instanceof ResourceNotFoundError) {
      return buildCsvImportErrorResponse(error.message, 400);
    }

    logger.error({ error }, "Failed to import CSV feedback source data");
    return buildCsvImportErrorResponse(CSV_IMPORT_FAILED_ERROR_CODE, 500);
  }
};
