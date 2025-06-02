import { AUDIT_LOG_ENABLED, ENCRYPTION_KEY } from "@/lib/constants";
import { TAuditLogEvent } from "@/modules/ee/audit-logs/types/audit-log";
import { createHash } from "crypto";
import { logger } from "@formbricks/logger";

const SENSITIVE_KEYS = [
  "email",
  "name",
  "password",
  "access_token",
  "refresh_token",
  "id_token",
  "twofactorsecret",
  "backupcodes",
  "session_state",
  "provideraccountid",
  "imageurl",
  "identityprovideraccountid",
  "locale",
  "token",
  "key",
  "secret",
  "code",
  "address",
  "phone",
  "hashedkey",
  "apikey",
  "createdby",
  "lastusedat",
  "expiresat",
  "acceptorid",
  "creatorid",
  "firstname",
  "lastname",
  "userid",
  "attributes",
];

/**
 * Computes the hash of the audit log event using the SHA256 algorithm.
 * @param event - The audit log event.
 * @param prevHash - The previous hash of the audit log event.
 * @returns The hash of the audit log event. The hash is computed by concatenating the secret, the previous hash, and the event and then hashing the result.
 */
export const computeAuditLogHash = (
  event: Omit<TAuditLogEvent, "integrityHash" | "previousHash" | "chainStart">,
  prevHash: string | null
): string => {
  let secret = ENCRYPTION_KEY;

  if (!secret) {
    // Log an error but don't throw an error to avoid blocking the main request
    logger.error(
      "ENCRYPTION_KEY is not set, creating audit log hash without it. Please set ENCRYPTION_KEY in the environment variables to avoid security issues."
    );
    secret = "";
  }

  const hash = createHash("sha256");
  hash.update(secret + (prevHash ?? "") + JSON.stringify(event));
  return hash.digest("hex");
};

/**
 * Redacts sensitive data from the object by replacing the sensitive keys with "********".
 * @param obj - The object to redact.
 * @returns The object with the sensitive data redacted.
 */
export const redactPII = (obj: any, seen: WeakSet<any> = new WeakSet()): any => {
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (obj && typeof obj === "object") {
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => redactPII(v, seen));
  }
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase() === sensitiveKey)) {
          return [key, "********"];
        }
        return [key, redactPII(value, seen)];
      })
    );
  }
  return obj;
};

/**
 * Computes the difference between two objects and returns the new object with the changes.
 * @param oldObj - The old object.
 * @param newObj - The new object.
 * @returns The difference between the two objects.
 */
export const deepDiff = (oldObj: any, newObj: any): any => {
  if (typeof oldObj !== "object" || typeof newObj !== "object" || oldObj === null || newObj === null) {
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      return newObj;
    }
    return undefined;
  }

  const diff: Record<string, any> = {};
  const keys = new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);
  for (const key of keys) {
    const valueDiff = deepDiff(oldObj?.[key], newObj?.[key]);
    if (valueDiff !== undefined) {
      diff[key] = valueDiff;
    }
  }
  return Object.keys(diff).length > 0 ? diff : undefined;
};

if (AUDIT_LOG_ENABLED && !ENCRYPTION_KEY) {
  throw new Error(
    "ENCRYPTION_KEY must be set when AUDIT_LOG_ENABLED is enabled. Refusing to start for security reasons."
  );
}
