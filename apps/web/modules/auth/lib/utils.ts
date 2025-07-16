import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { getRedisClient } from "@/modules/cache/redis";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditAction, TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import * as Sentry from "@sentry/nextjs";
import { compare, hash } from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { logger } from "@formbricks/logger";

export const hashPassword = async (password: string) => {
  const hashedPassword = await hash(password, 12);
  return hashedPassword;
};

export const verifyPassword = async (password: string, hashedPassword: string) => {
  const isValid = await compare(password, hashedPassword);
  return isValid;
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
  additionalData: Record<string, any> = {}
) => {
  const auditActorId = userId === UNKNOWN_DATA && email ? createAuditIdentifier(email, "email") : userId;

  // Log failures to Sentry for monitoring and alerting
  if (status === "failure" && SENTRY_DSN && IS_PRODUCTION) {
    const error = new Error(`Authentication ${action} failed`);
    Sentry.captureException(error, {
      tags: {
        component: "authentication",
        action,
        status,
        ...(additionalData.tags ?? {}),
      },
      extra: {
        userId: auditActorId,
        provider: additionalData.provider,
        authMethod: additionalData.authMethod,
        failureReason: additionalData.failureReason,
        ...additionalData,
      },
    });
  }

  queueAuditEventBackground({
    action,
    targetType: "user",
    userId: auditActorId,
    targetId: auditActorId,
    organizationId: UNKNOWN_DATA,
    status,
    userType: "user",
    newObject: {
      ...additionalData,
    },
  });
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
  additionalData: Record<string, any> = {}
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
  additionalData: Record<string, any> = {}
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
  additionalData: Record<string, any> = {}
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
  additionalData: Record<string, any> = {}
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

// Rate limiting constants
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const AGGREGATION_THRESHOLD = 3; // After 3 failures, start aggregating

/**
 * Rate limiting decision function for authentication audit logs.
 * Uses Redis for distributed rate limiting across Kubernetes pods.
 *
 * **What this function does:**
 * - Returns true/false to indicate whether an auth attempt should be logged
 * - Always returns true for successful authentications (no rate limiting)
 * - For failures: allows first 3 attempts per identifier within 5-minute window
 * - After 3 failures: allows every 10th attempt OR after 1+ minute gap
 * - Uses hashed identifiers to protect PII while enabling tracking
 * - Returns false if Redis is unavailable (fail closed)
 *
 * **Use cases:**
 * - Gate authentication failure logging to prevent spam
 * - Provide consistent rate limiting decisions across Kubernetes pods
 * - Protect user PII through identifier hashing
 *
 * **Example usage:**
 * ```typescript
 * if (await shouldLogAuthFailure(user.email)) {
 *   logAuthAttempt("invalid_password", "credentials", "password", user.id, user.email);
 * }
 * ```
 *
 * @param identifier - Unique identifier for rate limiting (email, token, etc.) - will be hashed
 * @param isSuccess - Whether this is a successful authentication (defaults to false)
 * @returns Promise<boolean> - Whether this attempt should be logged to audit trail
 */
export const shouldLogAuthFailure = async (
  identifier: string,
  isSuccess: boolean = false
): Promise<boolean> => {
  // Always log successful authentications
  if (isSuccess) return true;

  const rateLimitKey = `rate_limit:auth:${createAuditIdentifier(identifier, "ratelimit")}`;
  const now = Date.now();

  try {
    // Get Redis client
    const redis = getRedisClient();
    if (!redis) {
      logger.warn("Redis not available for rate limiting, not logging due to Redis requirement");
      return false;
    }

    // Use Redis for distributed rate limiting
    const multi = redis.multi();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Remove expired entries and count recent failures
    multi.zRemRangeByScore(rateLimitKey, 0, windowStart);
    multi.zCard(rateLimitKey);
    multi.zAdd(rateLimitKey, { score: now, value: `${now}:${randomUUID()}` });
    multi.expire(rateLimitKey, Math.ceil(RATE_LIMIT_WINDOW / 1000));

    const results = await multi.exec();
    if (!results) {
      throw new Error("Redis transaction failed");
    }

    const currentCount = results[1] as number;

    // Apply throttling logic
    if (currentCount <= AGGREGATION_THRESHOLD) {
      return true;
    }

    // Check if we should log (every 10th or after 1 minute gap)
    const recentEntries = await redis.zRange(rateLimitKey, -10, -1);
    if (recentEntries.length === 0) return true;

    const lastLogTime = Number.parseInt(recentEntries[recentEntries.length - 1].split(":")[0]);
    const timeSinceLastLog = now - lastLogTime;

    return currentCount % 10 === 0 || timeSinceLastLog > 60000;
  } catch (error) {
    logger.warn("Redis rate limiting failed, not logging due to Redis requirement", { error });
    // If Redis fails, do not log as Redis is required for audit logs
    return false;
  }
};

/**
 * Logs a user sign out event for audit compliance.
 *
 * @param userId - The ID of the user signing out
 * @param userEmail - The email of the user signing out
 * @param context - Additional context about the sign out (reason, redirect URL, etc.)
 */
export const logSignOut = (
  userId: string,
  userEmail: string,
  context?: {
    reason?:
      | "user_initiated"
      | "account_deletion"
      | "email_change"
      | "session_timeout"
      | "forced_logout"
      | "password_reset";
    redirectUrl?: string;
    organizationId?: string;
  }
) => {
  logAuthEvent("userSignedOut", "success", userId, userEmail, {
    provider: "session",
    authMethod: "sign_out",
    reason: context?.reason || "user_initiated", // NOSONAR // We want to check for empty strings
    redirectUrl: context?.redirectUrl,
    organizationId: context?.organizationId,
  });
};
