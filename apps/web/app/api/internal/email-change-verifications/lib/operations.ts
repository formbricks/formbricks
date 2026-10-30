import "server-only";
import { JsonWebTokenError } from "jsonwebtoken";
import { logger } from "@formbricks/logger";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { applyIPRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { noContentResponse, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { InvalidEmailChangeTokenError, verifyEmailChangeToken } from "@/lib/jwt";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { getUser, updateUser } from "@/modules/auth/lib/user";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TEmailChangeVerificationBody } from "../schemas";

type TRequestContext = { requestId: string; instance?: string; auditLog?: TV3AuditLog };

/**
 * `POST /api/internal/email-change-verifications`: switch an account to the address its token confirms.
 * Unauthenticated on purpose: the link is opened from the new mailbox, often in another browser. What makes
 * that safe is the token's binding to the credential state it was issued under (`verifyEmailChangeToken`),
 * so a password reset or a later email change kills it (ENG-2106). Answers 204: the page needs to know it
 * worked, and a token holder has no business reading the account back.
 */
export async function verifyEmailChangeOperation({
  body,
  ...context
}: TRequestContext & { body: TEmailChangeVerificationBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.auth.verifyEmail, context);
  if (limited) {
    // The limiter logs the refusal; auditing it too would let one address add rows without bound.
    skipV3AuditLog(auditLog);
    return limited;
  }

  let verified: { id: string; email: string };
  try {
    verified = await verifyEmailChangeToken(body.token);
  } catch (error) {
    // A bad or stale link is the caller's problem; a missing key or a database failure is ours.
    if (!(error instanceof JsonWebTokenError || error instanceof InvalidEmailChangeTokenError)) throw error;
    logger.warn({ err: error }, "Email change token refused");
    return problemUnprocessableContent(requestId, "The confirmation link is invalid or has expired.", {
      instance,
      details: { reason: "invalid_or_expired" },
    });
  }
  // The account is the target; the actor stays unknown, as with the action this replaces: whoever holds
  // the link is not signed in.
  if (auditLog) auditLog.targetId = verified.id;

  const before = await getUser(verified.id);
  const user = await updateUser(verified.id, { email: verified.email, emailVerified: true });
  if (!user) throw new Error("User not found or email update failed");
  if (auditLog) {
    auditLog.oldObject = before;
    auditLog.newObject = user;
  }

  await updateBrevoCustomer({ id: user.id, email: user.email });
  return noContentResponse({ requestId });
}
