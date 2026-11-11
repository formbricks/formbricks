import "server-only";
import { InvalidInputError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { applyIPRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { createEmailToken } from "@/lib/jwt";
import {
  type TSignupAuditTrail,
  assertSignupAdmissible,
  createSignup,
} from "@/modules/auth/signup/lib/sign-up";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TSignupBody } from "../schemas";

type TRequestContext = { requestId: string; instance?: string; auditLog?: TV3AuditLog };

/** Copy what the sign-up got to into its audit entry, whether it finished or threw partway. */
const recordTrail = (auditLog: TV3AuditLog | undefined, trail: TSignupAuditTrail) => {
  if (!auditLog) return;
  if (trail.organizationId) auditLog.organizationId = trail.organizationId;
  if (trail.user) {
    auditLog.targetId = trail.user.id;
    auditLog.newObject = trail.user;
  }
};

/**
 * `POST /api/internal/signups`: create a credential account (pre-login). Charged to the client's IP.
 *
 * The answer is deliberately invariant (ENG-2099): it never varies with whether the address already had
 * an account, nor with what happened to the verification email, or it would be a lookup. The
 * verification-requested screen the form lands on is phrased conditionally and carries a log-in link, so
 * the existing-account visitor still has a way out. It carries the display token for the address that
 * screen echoes back. A refusal the form explains is a 422 whose `details.reason` (and `detail`) is the
 * stable code it translates.
 */
export async function createSignupOperation({
  body,
  ...context
}: TRequestContext & { body: TSignupBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.auth.signup, context);
  if (limited) {
    // Not audited, unlike the action: the IP budget is what bounds this pre-login route's audit rows, and
    // auditing every refusal past it would be unbounded (the limiter logs it instead).
    skipV3AuditLog(auditLog);
    return limited;
  }

  const trail: TSignupAuditTrail = {};
  let emailToken: string;
  try {
    const admission = await assertSignupAdmissible(body);
    // The token the "check your inbox" screen echoes the address back from: purpose-scoped and short-lived
    // (`createEmailToken`), minted for the address submitted, with no user lookup, so it is issued
    // alike whether or not the address already had an account. Minted before the account is written so a
    // missing key fails the sign-up instead of leaving an account behind a 500.
    emailToken = createEmailToken(body.email.toLowerCase());
    await createSignup(body, admission, trail);
  } catch (error) {
    recordTrail(auditLog, trail);
    if (error instanceof InvalidInputError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        details: { reason: error.message },
      });
    }
    throw error;
  }

  // No account was created, so no `created` event may be written: the answer below is the same either
  // way, and only the audit record may tell them apart (ENG-2091).
  if (trail.user) recordTrail(auditLog, trail);
  else skipV3AuditLog(auditLog);

  return successResponse({ success: true, emailToken }, { requestId });
}
