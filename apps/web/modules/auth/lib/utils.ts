import { createHash, randomUUID } from "crypto";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditAction, TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { sampleAuthFailure } from "./auth-failure-sampling";
import { nativeAuthAuditContext } from "./native-auth-audit-context";

export const hashPassword = async (password: string) => {
  return await hashSecret(password, 12);
};

export const verifyPassword = async (password: string, hashedPassword: string) => {
  return await verifySecret(password, hashedPassword);
};

/**
 * Creates a consistent hashed identifier for audit logging that protects PII
 * while still allowing pattern tracking and rate limiting.
 *
 * @param identifier - The identifier to hash (email, IP, etc.)
 * @param prefix - Optional prefix for the hash (e.g., "email", "ip")
 * @returns A consistent SHA-256 hash that can be used for tracking without exposing PII
 */
export const createAuditIdentifier = (identifier: string, prefix: string = "actor"): string => {
  if (!identifier || identifier === "unknown" || identifier === "unknown_user") {
    return UNKNOWN_DATA;
  }

  // Create a consistent hash that can be used for pattern detection
  // Use a longer hash for better collision resistance in compliance scenarios
  const hash = createHash("sha256").update(identifier.toLowerCase()).digest("hex");
  return `${prefix}_${hash.substring(0, 32)}`; // Use first 32 chars for better uniqueness
};

export const logAuthEvent = (
  action: TAuditAction,
  status: TAuditStatus,
  userId: string,
  email?: string,
  additionalData: Record<string, unknown> = {}
) => {
  const auditActorId = userId === UNKNOWN_DATA && email ? createAuditIdentifier(email, "email") : userId;

  // Auth failures are NOT sent to Sentry: they're expected (wrong password / unknown user), so
  // capturing every attempt was noise, not signal. The security trail is the audit log below
  // (throttled by shouldLogAuthFailure + rate-limiting); genuine *internal* auth errors are still
  // captured via the Better Auth logger's error level (ENG-2037).
  void queueAuditEventBackground({
    action,
    targetType: "user",
    userId: auditActorId,
    targetId: auditActorId,
    organizationId: "global",
    scope: "global",
    source: "native-auth",
    requestId: nativeAuthAuditContext.getStore()?.requestId ?? randomUUID(),
    status,
    userType: userId === UNKNOWN_DATA ? "anonymous" : "user",
    newObject: {
      ...additionalData,
    },
  }).catch(() => {});
};

/**
 * Helper function for logging authentication attempts with consistent failure reasons.
 *
 * @param failureReason - Specific reason for authentication failure
 * @param provider - Authentication provider (credentials, token, etc.)
 * @param authMethod - Authentication method (password, totp, backup_code, etc.)
 * @param userId - User ID (use UNKNOWN_DATA if not available)
 * @param email - User email (optional) - used ONLY to create hashed identifier, never stored
 * @param additionalData - Additional context data
 */
export const logAuthAttempt = (
  failureReason: string,
  provider: string,
  authMethod: string,
  userId: string = UNKNOWN_DATA,
  email?: string,
  additionalData: Record<string, unknown> = {}
) => {
  logAuthEvent("authenticationAttempted", "failure", userId, email, {
    failureReason,
    provider,
    authMethod,
    ...additionalData,
  });
};

/**
 * Helper function for logging successful authentication events.
 *
 * @param action - The specific success action (passwordVerified, twoFactorVerified, etc.)
 * @param provider - Authentication provider
 * @param authMethod - Authentication method
 * @param userId - User ID
 * @param email - User email - used ONLY to create hashed identifier, never stored
 * @param additionalData - Additional context data
 */
export const logAuthSuccess = (
  action: TAuditAction,
  provider: string,
  authMethod: string,
  userId: string,
  email: string,
  additionalData: Record<string, unknown> = {}
) => {
  logAuthEvent(action, "success", userId, email, {
    provider,
    authMethod,
    ...additionalData,
  });
};

/**
 * Helper function for logging two-factor authentication attempts.
 *
 * @param isSuccess - Whether the 2FA attempt was successful
 * @param authMethod - 2FA method (totp, backup_code)
 * @param userId - User ID
 * @param email - User email - used ONLY to create hashed identifier, never stored
 * @param failureReason - Failure reason (only for failed attempts)
 * @param additionalData - Additional context data
 */
export const logTwoFactorAttempt = (
  isSuccess: boolean,
  authMethod: string,
  userId: string,
  email: string,
  failureReason?: string,
  additionalData: Record<string, unknown> = {}
) => {
  const action = isSuccess ? "twoFactorVerified" : "twoFactorAttempted";
  const status = isSuccess ? "success" : "failure";

  logAuthEvent(action, status, userId, email, {
    provider: "credentials",
    authMethod,
    ...(failureReason && !isSuccess ? { failureReason } : {}),
    ...additionalData,
  });
};

/**
 * Helper function for logging email verification attempts.
 *
 * @param isSuccess - Whether the verification was successful
 * @param failureReason - Failure reason (only for failed attempts)
 * @param userId - User ID (use UNKNOWN_DATA if not available)
 * @param email - User email (optional) - used ONLY to create hashed identifier, never stored
 * @param additionalData - Additional context data
 */
export const logEmailVerificationAttempt = (
  isSuccess: boolean,
  failureReason?: string,
  userId: string = UNKNOWN_DATA,
  email?: string,
  additionalData: Record<string, unknown> = {}
) => {
  const action = isSuccess ? "emailVerified" : "emailVerificationAttempted";
  const status = isSuccess ? "success" : "failure";

  logAuthEvent(action, status, userId, email, {
    provider: "token",
    authMethod: "email_verification",
    ...(failureReason && !isSuccess ? { failureReason } : {}),
    ...additionalData,
  });
};

/** Compatibility helper for callers that only need the sampling decision. */
export const shouldLogAuthFailure = async (identifier: string, isSuccess = false): Promise<boolean> =>
  isSuccess || (await sampleAuthFailure(identifier)).emit;
