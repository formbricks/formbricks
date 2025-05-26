import { AUDIT_LOG_ENABLED, AUDIT_LOG_GET_USER_IP, AUDIT_LOG_SECRET } from "@/lib/constants";
import { ActionClientCtx } from "@/lib/utils/action-client";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { logAuditEvent } from "@/modules/ee/audit-logs/lib/service";
import {
  TActor,
  TAuditAction,
  TAuditActionType,
  TAuditLogEvent,
  TAuditStatus,
  TAuditTarget,
  UNKNOWN_DATA,
} from "@/modules/ee/audit-logs/types/audit-log";
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

let previousAuditLogHash: string | null = null;
let isChainStart = true;

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
  let secret = AUDIT_LOG_SECRET;

  if (!secret) {
    // Log an error but don't throw an error to avoid blocking the main request
    logger.error(
      "AUDIT_LOG_SECRET is not set, creating audit log hash without it. Please set AUDIT_LOG_SECRET in the environment variables to avoid security issues."
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
export const redactPII = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(redactPII);
  }
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))) {
          return [key, "********"];
        }
        return [key, redactPII(value)];
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

/**
 * Builds an audit event and logs it.
 * Redacts sensitive data from the old and new objects and computes the hash of the event before logging it.
 *
 * @param actionType - The type of action to audit.
 * @param targetType - The type of target (e.g., "segment", "survey").
 * @param userId - The ID of the user performing the action.
 * @param userType - The type of user (e.g., "user", "api").
 * @param targetId - The ID of the target (e.g., segment ID, survey ID).
 * @param organizationId - The ID of the organization.
 * @param ipAddress - The IP address of the user.
 * @param status - The status of the action ("success" or "failure").
 * @param oldObject - The old object (optional).
 * @param newObject - The new object (optional).
 * @param eventId - The ID of the event.
 * @param apiUrl - The URL of the API request.
 */
export const buildAndLogAuditEvent = async ({
  actionType,
  targetType,
  userId,
  userType,
  targetId,
  organizationId,
  ipAddress,
  status,
  oldObject,
  newObject,
  eventId,
  apiUrl,
}: {
  actionType: TAuditActionType;
  targetType: TAuditTarget;
  userId: string;
  userType: TActor;
  targetId: string;
  organizationId: string;
  ipAddress: string;
  status: TAuditStatus;
  oldObject?: any;
  newObject?: any;
  eventId?: string;
  apiUrl?: string;
}) => {
  if (!AUDIT_LOG_ENABLED) {
    return;
  }

  try {
    let changes;
    if (oldObject && newObject) {
      changes = deepDiff(oldObject, newObject);
      changes = redactPII(changes);
    } else if (newObject) {
      changes = redactPII(newObject);
    } else if (oldObject) {
      changes = redactPII(oldObject);
    }

    const eventBase: Omit<TAuditLogEvent, "integrityHash" | "previousHash" | "chainStart"> = {
      actor: { id: userId, type: userType },
      action: actionType,
      target: { id: targetId, type: targetType },
      timestamp: new Date().toISOString(),
      organizationId,
      status,
      ipAddress: AUDIT_LOG_GET_USER_IP ? ipAddress : UNKNOWN_DATA,
      apiUrl,
      ...(changes ? { changes } : {}),
      ...(status === "failure" && eventId ? { eventId } : {}),
    };

    // Compute hash
    const integrityHash = computeAuditLogHash(eventBase, previousAuditLogHash);

    const auditEvent: TAuditLogEvent = {
      ...eventBase,
      integrityHash,
      previousHash: previousAuditLogHash,
      ...(isChainStart ? { chainStart: true } : {}),
    };

    previousAuditLogHash = integrityHash;
    isChainStart = false;

    await logAuditEvent(auditEvent);
  } catch (logError) {
    logger.error(logError, "Failed to create audit log event");
  }
};

/**
 * Logs an audit event.
 * The audit logging runs in the background to avoid blocking the main request.
 *
 * @param actionType - The type of action to audit.
 * @param targetType - The type of target (e.g., "segment", "survey").
 * @param userId - The ID of the user performing the action.
 * @param targetId - The ID of the target (e.g., segment ID, survey ID).
 * @param organizationId - The ID of the organization.
 * @param ipAddress - The IP address of the user.
 * @param oldObject - The old object (optional).
 * @param newObject - The new object (optional).
 * @param status - The status of the action ("success" or "failure").
 * @param apiUrl - The URL of the API request.
 **/
export const queueAuditEventBackground = async ({
  actionType,
  targetType,
  userId,
  userType,
  targetId,
  organizationId,
  oldObject,
  newObject,
  status,
  eventId,
  apiUrl,
}: {
  actionType: TAuditActionType;
  targetType: TAuditTarget;
  userId: string;
  userType: TActor;
  targetId: string;
  organizationId: string;
  oldObject?: any;
  newObject?: any;
  status: TAuditStatus;
  eventId?: string;
  apiUrl?: string;
}) => {
  setImmediate(async () => {
    const ipAddress = await getClientIpFromHeaders();

    await buildAndLogAuditEvent({
      actionType,
      targetType,
      userId,
      userType,
      targetId,
      organizationId,
      ipAddress,
      status,
      oldObject,
      newObject,
      eventId,
      apiUrl,
    });
  });
};

/**
 * Logs an audit event.
 * This function will block the main request. Use it only in edge runtime functions, like api routes.
 *
 * @param actionType - The type of action to audit.
 * @param targetType - The type of target (e.g., "segment", "survey").
 * @param userId - The ID of the user performing the action.
 * @param targetId - The ID of the target (e.g., segment ID, survey ID).
 * @param organizationId - The ID of the organization.
 * @param ipAddress - The IP address of the user.
 * @param oldObject - The old object (optional).
 * @param newObject - The new object (optional).
 * @param status - The status of the action ("success" or "failure").
 * @param apiUrl - The URL of the API request.
 **/
export const queueAuditEvent = async ({
  actionType,
  targetType,
  userId,
  userType,
  targetId,
  organizationId,
  oldObject,
  newObject,
  status,
  eventId,
  apiUrl,
}: {
  actionType: TAuditActionType;
  targetType: TAuditTarget;
  userId: string;
  userType: TActor;
  targetId: string;
  organizationId: string;
  oldObject?: any;
  newObject?: any;
  status: TAuditStatus;
  eventId?: string;
  apiUrl?: string;
}) => {
  const ipAddress = await getClientIpFromHeaders();

  await buildAndLogAuditEvent({
    actionType,
    targetType,
    userId,
    userType,
    targetId,
    organizationId,
    ipAddress,
    status,
    oldObject,
    newObject,
    eventId,
    apiUrl,
  });
};

// Type for the auditLoggingCtx field in the ActionClientCtx
export type AuditLoggingCtx = {
  organizationId?: string;
  ipAddress: string;
  segmentId?: string;
  surveyId?: string;
  oldObject?: any;
  newObject?: any;
  eventId?: string;
};

/**
 * Wraps a handler function with audit logging.
 * Logs audit events for server actions. Specifically for server actions that use next-server-action library middleware and it's context.
 * The audit logging runs in the background to avoid blocking the main request.
 *
 * @param actionType - The type of action to audit.
 * @param targetType - The type of target (e.g., "segment", "survey").
 * @param handler - The handler function to wrap.
 **/
export const withAuditLogging = (
  actionType: TAuditAction,
  targetType: TAuditTarget,
  handler: (args: { ctx: ActionClientCtx; parsedInput: any }) => Promise<any>
) => {
  return async function wrappedAction(args: { ctx: ActionClientCtx; parsedInput: any }) {
    const { ctx, parsedInput } = args;
    const { auditLoggingCtx } = ctx;
    let result: any;
    let status: "success" | "failure" = "success";
    let error: any = undefined;

    try {
      result = await handler(args);
    } catch (err) {
      status = "failure";
      error = err;
    }

    if (!AUDIT_LOG_ENABLED) {
      return result;
    }

    setImmediate(async () => {
      try {
        const userId: string = ctx?.user?.id ?? UNKNOWN_DATA;
        let organizationId: string =
          parsedInput?.organizationId || auditLoggingCtx?.organizationId || UNKNOWN_DATA; // NOSONAR // We want to use the organizationId from the parsedInput if it is present and not empty

        if (!organizationId) {
          const environmentId: string | undefined = parsedInput?.environmentId;
          if (environmentId) {
            try {
              organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
            } catch (err) {
              logger.error(err, "Failed to get organizationId from environmentId in audit logging");
              organizationId = UNKNOWN_DATA;
            }
          } else {
            organizationId = UNKNOWN_DATA;
          }
        }

        let targetId: string;
        switch (targetType) {
          case "segment":
            targetId = auditLoggingCtx?.segmentId ?? UNKNOWN_DATA;
            break;
          case "survey":
            targetId = auditLoggingCtx?.surveyId ?? UNKNOWN_DATA;
            break;
          default:
            targetId = UNKNOWN_DATA;
            break;
        }

        await buildAndLogAuditEvent({
          actionType: `${targetType}.${actionType}`,
          targetType,
          userId,
          userType: "user",
          targetId,
          organizationId,
          ipAddress: AUDIT_LOG_GET_USER_IP ? auditLoggingCtx?.ipAddress : UNKNOWN_DATA,
          status,
          oldObject: auditLoggingCtx.oldObject,
          newObject: auditLoggingCtx.newObject,
          eventId: auditLoggingCtx.eventId,
        });
      } catch (logError) {
        logger.error(logError, "Failed to create audit log event");
      }
    });

    if (status === "failure") throw error;
    return result;
  };
};

if (AUDIT_LOG_ENABLED && !AUDIT_LOG_SECRET) {
  throw new Error(
    "AUDIT_LOG_SECRET must be set when AUDIT_LOG_ENABLED is enabled. Refusing to start for security reasons."
  );
}
