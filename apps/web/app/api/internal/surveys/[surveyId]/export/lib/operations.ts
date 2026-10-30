import "server-only";
import { logger } from "@formbricks/logger";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TUserLocale } from "@formbricks/types/user";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import type { TV3SurveyResourceVisibility } from "@/app/api/v3/surveys/serializers";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { buildAttachmentContentDisposition, buildDownloadFileName } from "@/lib/utils/content-disposition";
import { getTranslate } from "@/lingodotdev/server";
import {
  EXCEL_EXPORT_CONTENT_TYPE,
  EXCEL_EXPORT_EXTENSION,
  EXCEL_EXPORT_FORMAT,
  writeExcelExport,
} from "@/modules/survey/excel-export/write";
import type { TSurveyExportFormat } from "@/modules/survey/export/lib/formats";
import { FORMBRICKS_FILE_EXTENSION, FORMBRICKS_FILE_FORMAT } from "@/modules/survey/formbricks-file/envelope";
import { exportFormbricksFile } from "@/modules/survey/formbricks-file/export";

/** The name a file gets when the survey's own name leaves nothing usable. */
const FALLBACK_FILE_NAME = "survey";

/** One export's file: its bytes, how to label them, and the version of its format. */
type TExportFile = {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
  extension: string;
  fileFormat: number;
};

/** The exporting user's locale, which the Excel export's headers and Logic column are written in. */
const getExportLocale = async (authentication: TV3Authentication): Promise<TUserLocale> => {
  const userId = authentication && "user" in authentication ? authentication.user?.id : undefined;
  return (userId ? await getUserLocale(userId) : undefined) ?? DEFAULT_LOCALE;
};

const buildExportFile = async ({
  format,
  survey,
  visibility,
  authentication,
}: {
  format: TSurveyExportFormat;
  survey: TSurvey;
  visibility: TV3SurveyResourceVisibility;
  authentication: TV3Authentication;
}): Promise<TExportFile> => {
  switch (format) {
    case "json": {
      const file = await exportFormbricksFile({ survey, visibility });
      return {
        body: new TextEncoder().encode(`${JSON.stringify(file, null, 2)}\n`),
        contentType: "application/json",
        extension: FORMBRICKS_FILE_EXTENSION,
        fileFormat: FORMBRICKS_FILE_FORMAT,
      };
    }
    case "xlsx": {
      const locale = await getExportLocale(authentication);
      return {
        body: writeExcelExport({ survey, t: await getTranslate(locale), locale }),
        contentType: EXCEL_EXPORT_CONTENT_TYPE,
        extension: EXCEL_EXPORT_EXTENSION,
        fileFormat: EXCEL_EXPORT_FORMAT,
      };
    }
  }
};

/**
 * One survey as a downloadable file. Anyone who may read the survey may export it, read-only members
 * included: the file holds nothing the survey page does not show. An unknown survey and one the caller
 * may not read get the same 403, so the route cannot be used to probe for surveys.
 *
 * The body is the file's bytes, sent whole with a `Content-Length` rather than streamed: a survey body is
 * capped at 2 MB, and a client that knows the length can tell a complete download from a cut one. Each
 * format is a Formbricks file (ADR 0016) or an Excel export (ADR 0017), with the same headers, access
 * check and audit event.
 */
export async function exportSurveyOperation({
  surveyId,
  format,
  authentication,
  requestId,
  instance,
  auditLog,
}: {
  surveyId: string;
  format: TSurveyExportFormat;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId, format });

  try {
    const { survey, authResult, response, visibility } = await getAuthorizedV3Survey({
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

    const { body, contentType, extension, fileFormat } = await buildExportFile({
      format,
      survey,
      visibility,
      authentication,
    });
    const fileName = buildDownloadFileName(survey.name, extension, FALLBACK_FILE_NAME);

    // Only once access is granted: a refused request must not file an event under the organization of a
    // survey the caller could not see.
    if (auditLog) {
      auditLog.organizationId = authResult.organizationId;
      auditLog.targetId = survey.id;
      auditLog.newObject = { format, fileFormat, workspaceId: survey.workspaceId };
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildAttachmentContentDisposition(fileName),
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "surveys.export" });
  }
}
