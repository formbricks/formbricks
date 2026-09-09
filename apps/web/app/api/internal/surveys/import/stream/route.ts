/**
 * POST /api/internal/surveys/import/stream — convert an uploaded survey file and stream the result as
 * NDJSON, so the import dialog shows progress per stage and per chunk and questions appearing while
 * the model reads a document.
 *
 * Internal surface: no OpenAPI entry and no stability promise, but every other v3 convention applies
 * (ENG-1668 / the Internal API RFC). Deliberately *not* under /api/v3: the documented
 * `POST /api/v3/surveys/import/convert` stays the stable, blocking, machine-facing endpoint, and an
 * NDJSON stream cannot be expressed to the Schemathesis contract suite.
 *
 * Session-only and multipart-only. The wrapper's rate limit is the convert bucket (30/min); the AI
 * lane additionally spends from the shared 10/min AI budget inside the handler, like the blocking
 * route.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import {
  IMPORT_CONVERT_BODY_LIMIT_BYTES,
  ZV3SurveyImportConvertBody,
} from "@/app/api/v3/surveys/import/convert/schemas";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { streamImportConversion } from "../lib/operations";

// File parsing needs Node buffers and @formbricks/ai pulls the provider SDKs; nothing here is edge-compatible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const POST = withV3ApiWrapper({
  auth: "session",
  body: "multipart",
  bodyLimitBytes: IMPORT_CONVERT_BODY_LIMIT_BYTES,
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyImportConvert,
  schemas: {
    body: ZV3SurveyImportConvertBody,
  },
  // No action/targetType: nothing is persisted here (the survey row is written by POST /api/v3/surveys/import,
  // which audits already), and a stream's response.ok is true the instant we return.
  handler: async ({ req, authentication, parsedInput, requestId, instance }) =>
    streamImportConversion({ req, authentication, body: parsedInput.body, requestId, instance }),
});
