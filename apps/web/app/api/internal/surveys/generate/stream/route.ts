/**
 * POST /api/internal/surveys/generate/stream — stream a survey draft as the model writes it, so the
 * create dialog can show questions appearing instead of a spinner.
 *
 * Internal surface: no OpenAPI entry and no stability promise, but every other v3 convention
 * applies (ENG-1668 / the Internal API RFC). Deliberately *not* under /api/v3: the documented
 * `POST /api/v3/surveys/generate` stays the stable, blocking, machine-facing endpoint, and enrolling
 * an NDJSON stream in the Schemathesis contract suite would burn a live provider call per run to
 * check a schema it cannot express.
 *
 * Session-only: an API-key caller already has the blocking endpoint, and there is no reason to hand
 * a machine client a chunked, UI-shaped stream. The rate limit is deliberately the same bucket as
 * the blocking route — the 10/min budget caps AI spend, and both entry points spend from it.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3SurveyGenerateBody } from "@/app/api/v3/surveys/generate/schemas";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { streamV3SurveyGeneration } from "../lib/operations";

// @formbricks/ai pulls the provider SDKs and posthog-node, none of which are edge-compatible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const POST = withV3ApiWrapper({
  auth: "session",
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyGenerate,
  schemas: {
    body: ZV3SurveyGenerateBody,
  },
  // No action/targetType: nothing is persisted here (the survey row is written by the existing
  // POST /api/v3/surveys, which audits already), and the wrapper derives auditLog.status from
  // response.ok — which for a stream is true the instant we return, so a stream that later failed
  // would log a success.
  handler: async ({ req, authentication, parsedInput, requestId, instance }) =>
    streamV3SurveyGeneration({
      req,
      authentication,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});
