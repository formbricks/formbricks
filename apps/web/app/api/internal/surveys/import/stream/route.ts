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
 * The body keeps the v3 array budget, so a file is held to about 1,000 elements (`SurveyElements` is one
 * flat array of every question, block and setting), far above any survey seen in production. Past
 * it, the 400 names the `qsf.` array, which is how the dialog tells it from a malformed body, and no AI
 * is spent. A lower, question-level limit with its own message belongs to the reader (ENG-3654).
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ConcurrencyLimiter } from "@/app/lib/api/concurrency-limiter";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  QSF_IMPORT_BODY_LIMIT_BYTES,
  QSF_IMPORT_MAX_IN_FLIGHT,
  QSF_IMPORT_MAX_IN_FLIGHT_PER_USER,
  QSF_IMPORT_RETRY_AFTER_SECONDS,
} from "../lib/constants";
import { streamQsfImport } from "../lib/operations";
import { ZQsfImportStreamBody } from "../lib/schemas";

// @formbricks/ai pulls the provider SDKs and posthog-node, none of which are edge-compatible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * One per server process: the limit bounds what a pod spends on imports, and the per-user share keeps
 * one user from taking every slot.
 */
const importConcurrency = new ConcurrencyLimiter(QSF_IMPORT_MAX_IN_FLIGHT, {
  maxPerKey: QSF_IMPORT_MAX_IN_FLIGHT_PER_USER,
});

export const POST = withV3ApiWrapper({
  auth: "session",
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyGenerate,
  bodyLimitBytes: QSF_IMPORT_BODY_LIMIT_BYTES,
  concurrency: { limiter: importConcurrency, retryAfterSeconds: QSF_IMPORT_RETRY_AFTER_SECONDS },
  schemas: {
    body: ZQsfImportStreamBody,
  },
  handler: async ({ req, authentication, parsedInput, requestId, instance }) =>
    streamQsfImport({
      req,
      authentication,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});
