/**
 * POST /api/internal/surveys/{surveyId}/import/stream — import a file into this survey, from its menu
 * (ENG-6809): a Formbricks file, or the survey's own Excel export with its texts edited. Turns it into a
 * draft for review, streaming progress as NDJSON, like `POST /api/internal/surveys/import/stream`; the
 * review then updates this survey through `PUT /api/internal/surveys/{surveyId}/content`, or creates a
 * new one.
 *
 * Internal surface under the Internal API RFC (ENG-1668): session-only, no OpenAPI entry and no
 * stability promise, with every other v3 convention applied. The body is `multipart/form-data` with
 * exactly one file part, capped like the workspace import's. Neither kind of file needs AI, so the
 * default v3 bucket is all it is charged. Nothing is persisted here, so there is no audit entry.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import {
  SURVEY_IMPORT_MAX_BODY_BYTES,
  SURVEY_IMPORT_RETRY_AFTER_SECONDS,
} from "@/modules/survey/import/limits";
import { surveyImportConcurrency } from "../../../import/lib/concurrency";
import { streamSurveyImportIntoSurvey } from "../../../import/lib/operations";
import { ZSurveyImportIntoSurveyForm, ZSurveyImportIntoSurveyParams } from "../../../import/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const POST = withV3ApiWrapper({
  auth: "session",
  bodyLimitBytes: SURVEY_IMPORT_MAX_BODY_BYTES,
  concurrency: { limiter: surveyImportConcurrency, retryAfterSeconds: SURVEY_IMPORT_RETRY_AFTER_SECONDS },
  schemas: {
    params: ZSurveyImportIntoSurveyParams,
    formData: ZSurveyImportIntoSurveyForm,
  },
  handler: async ({ req, authentication, parsedInput, requestId, instance }) =>
    streamSurveyImportIntoSurvey({
      req,
      authentication,
      surveyId: parsedInput.params.surveyId,
      file: parsedInput.formData.file,
      requestId,
      instance,
    }),
});
