/**
 * POST /api/internal/surveys/import/stream — turn a Qualtrics survey export (.qsf) into a survey draft
 * for review, streaming progress as NDJSON (ENG-3604).
 *
 * Internal surface under the Internal API RFC (ENG-1668): session-only, no OpenAPI entry and no
 * stability promise, with every other v3 convention applied. It becomes public only when an outside
 * integration or agent needs to import QSF and we are ready to freeze the report's shape — then as a v3
 * route around the same pipeline function.
 *
 * Nothing is persisted here, so there is no audit entry: the survey is created, and audited, by
 * `POST /api/v3/surveys?createdFrom=import`. The rate limit is Create with AI's bucket on purpose; both
 * spend AI tokens.
 *
 * The body keeps the v3 request budget: at most 1,000 items in any one array, 50,000 across the file,
 * and 256 levels of nesting. In a QSF that means about 1,000 questions (`SurveyElements` holds one
 * element per question, trashed ones included, plus a few survey-wide ones) and 1,000 choices per
 * question (`Payload.ChoiceOrder`). `POST /api/v3/surveys` applies the same budget to the survey the
 * import becomes, so a question with more choices than that could not be created anyway. Past a limit,
 * the 400 names the `qsf.` path, so a client can tell it from a malformed body, and no AI is spent. A
 * lower, question-level limit with its own message belongs to the reader (ENG-3654).
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ConcurrencyLimiter } from "@/app/lib/api/concurrency-limiter";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  SURVEY_IMPORT_MAX_BODY_BYTES,
  SURVEY_IMPORT_MAX_IN_FLIGHT,
  SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER,
  SURVEY_IMPORT_RETRY_AFTER_SECONDS,
} from "@/modules/survey/import/limits";
import { qsfImportLane } from "@/modules/survey/import/qsf/lane";
import { streamSurveyImport } from "../lib/operations";
import { ZQsfImportStreamBody } from "../lib/schemas";

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
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyGenerate,
  bodyLimitBytes: SURVEY_IMPORT_MAX_BODY_BYTES,
  concurrency: { limiter: importConcurrency, retryAfterSeconds: SURVEY_IMPORT_RETRY_AFTER_SECONDS },
  schemas: {
    body: ZQsfImportStreamBody,
  },
  handler: async ({ req, authentication, parsedInput, requestId, instance }) =>
    streamSurveyImport({
      req,
      authentication,
      workspaceId: parsedInput.body.workspaceId,
      lane: qsfImportLane,
      input: { qsf: parsedInput.body.qsf, fileName: parsedInput.body.fileName },
      requestId,
      instance,
    }),
});
