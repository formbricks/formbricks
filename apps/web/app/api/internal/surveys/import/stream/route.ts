/**
 * POST /api/internal/surveys/import/stream — turn an uploaded survey file into a survey draft for review,
 * streaming progress as NDJSON (ENG-3604, ENG-6848).
 *
 * Internal surface under the Internal API RFC (ENG-1668): session-only, no OpenAPI entry and no
 * stability promise, with every other v3 convention applied.
 *
 * The body is `multipart/form-data` with the workspace and exactly one file part, for every file type
 * (CODING_STANDARDS.md "File Uploads and Downloads"). Anything else is a 415; wrong fields a 400. The
 * body is capped at `SURVEY_IMPORT_MAX_BODY_BYTES` from `Content-Length` and again while it streams in,
 * so a chunked upload needs no `Content-Length` (no 411). The operation then tells the file's type from
 * its bytes and holds it to the rest of the upload's limits before its lane reads it.
 *
 * Nothing is persisted here, so there is no audit entry: the survey is created, and audited, by
 * `POST /api/internal/surveys/imports`, or a matched one updated by
 * `PUT /api/internal/surveys/{surveyId}/content`. Every upload is charged to the default v3 bucket here; a lane
 * that spends AI tokens is charged Create with AI's bucket on top, once the operation knows the type.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ConcurrencyLimiter } from "@/app/lib/api/concurrency-limiter";
import {
  SURVEY_IMPORT_MAX_BODY_BYTES,
  SURVEY_IMPORT_MAX_IN_FLIGHT,
  SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER,
  SURVEY_IMPORT_RETRY_AFTER_SECONDS,
} from "@/modules/survey/import/limits";
import { streamSurveyImport } from "../lib/operations";
import { ZSurveyImportStreamForm } from "../lib/schemas";

// @formbricks/ai pulls the provider SDKs and posthog-node, none of which are edge-compatible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * One per server process: the limit bounds what a pod spends on imports, and the per-user share keeps
 * one user from taking every slot.
 */
const importConcurrency = new ConcurrencyLimiter(SURVEY_IMPORT_MAX_IN_FLIGHT, {
  maxPerKey: SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER,
});

export const POST = withV3ApiWrapper({
  auth: "session",
  bodyLimitBytes: SURVEY_IMPORT_MAX_BODY_BYTES,
  concurrency: { limiter: importConcurrency, retryAfterSeconds: SURVEY_IMPORT_RETRY_AFTER_SECONDS },
  schemas: {
    formData: ZSurveyImportStreamForm,
  },
  handler: async ({ req, authentication, parsedInput, requestId, instance }) =>
    streamSurveyImport({
      req,
      authentication,
      workspaceId: parsedInput.formData.workspaceId,
      file: parsedInput.formData.file,
      requestId,
      instance,
    }),
});
