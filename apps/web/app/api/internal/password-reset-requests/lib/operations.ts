import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import type { TPreLoginRequestContext } from "@/app/api/internal/lib/types";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { applyIPRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { noContentResponse, problemForbidden } from "@/app/api/v3/lib/response";
import { AUDIT_LOG_ENABLED, PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { processPasswordResetRequest } from "@/modules/auth/forgot-password/lib/password-reset-request";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  UNKNOWN_AUDIT_REQUEST_METADATA,
  getAuditRequestMetadata,
} from "@/modules/ee/audit-logs/lib/request-metadata";
import type { TPasswordResetRequestBody } from "../schemas";

/**
 * `POST /api/internal/password-reset-requests`: request a password reset (pre-login). Enumeration-safe by
 * construction (ENG-3639): before it answers it does only what is the same for every address — the
 * IP limit and the operator's kill switch — and hands the rest (lookup, reset link or SSO hint,
 * per-account limit, audit) to `after()`. So neither the answer nor how long it takes depends on whether
 * the address is registered, has a password, or was just throttled. Answers 204 either way.
 */
export async function requestPasswordResetOperation({
  body,
  ...context
}: TPreLoginRequestContext & { body: TPasswordResetRequestBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  // The IP limit comes first, as in the action: it bounds the audit rows the kill switch's refusal writes.
  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.auth.forgotPassword, context);
  if (limited) {
    // Not audited, unlike the action: the IP budget is what bounds this pre-login route's audit rows, and
    // auditing every refusal past it would be unbounded (the limiter logs it instead).
    skipV3AuditLog(auditLog);
    return limited;
  }

  // Audited as a refused reset, as before: it says nothing about the address.
  if (PASSWORD_RESET_DISABLED) return problemForbidden(requestId, "Password reset is disabled", instance);

  // The success event is recorded by `processPasswordResetRequest`, and only when a reset was really
  // requested; this request cannot know that by the time it answers.
  skipV3AuditLog(auditLog);

  // Copied while the request is live: Better Auth's hooks read them after the response has gone.
  const requestHeaders = new Headers(await headers());
  const requestMetadata = AUDIT_LOG_ENABLED
    ? await getAuditRequestMetadata(requestHeaders)
    : UNKNOWN_AUDIT_REQUEST_METADATA;
  after(() => processPasswordResetRequest({ email: body.email, requestHeaders, requestMetadata }));

  return noContentResponse({ requestId });
}
