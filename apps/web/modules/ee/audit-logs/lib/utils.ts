import { AUDIT_LOG_ENABLED, AUDIT_LOG_GET_USER_IP } from "@/lib/constants";
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
} from "@/modules/ee/audit-logs/types/audit-log";
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

function redactPII(obj: any): any {
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
}

function deepDiff(oldObj: any, newObj: any): any {
  if (typeof oldObj !== "object" || typeof newObj !== "object" || oldObj === null || newObj === null) {
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      return newObj;
    }
    return undefined;
  }

  const diff: Record<string, any> = {};
  const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of keys) {
    const valueDiff = deepDiff(oldObj?.[key], newObj?.[key]);
    if (valueDiff !== undefined) {
      diff[key] = valueDiff;
    }
  }
  return Object.keys(diff).length > 0 ? diff : undefined;
}

async function buildAndLogAuditEvent({
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
  targetId: string | undefined;
  organizationId: string;
  ipAddress: string;
  status: TAuditStatus;
  oldObject?: any;
  newObject?: any;
  eventId?: string;
  apiUrl?: string;
}) {
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

    const auditEvent: TAuditLogEvent = {
      actor: { id: userId, type: userType },
      action: actionType,
      target: { id: targetId, type: targetType },
      timestamp: new Date().toISOString(),
      organizationId,
      status,
      ipAddress: AUDIT_LOG_GET_USER_IP ? ipAddress : "unknown",
      apiUrl,
      ...(changes ? { changes } : {}),
    };

    if (status === "failure") {
      auditEvent.eventId = eventId;
    }

    await logAuditEvent(auditEvent);
  } catch (logError) {
    logger.error(logError, "Failed to create audit log event");
  }
}

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
export async function queueAuditEventBackground({
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
  targetId: string | undefined;
  organizationId: string;
  oldObject?: any;
  newObject?: any;
  status: TAuditStatus;
  eventId?: string;
  apiUrl?: string;
}) {
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
}

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
export async function queueAuditEvent({
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
  targetId: string | undefined;
  organizationId: string;
  oldObject?: any;
  newObject?: any;
  status: TAuditStatus;
  eventId?: string;
  apiUrl?: string;
}) {
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
}

/**
 * Wraps a handler function with audit logging.
 * Logs audit events for server actions.
 * The audit logging runs in the background to avoid blocking the main request.
 *
 * @param actionType - The type of action to audit.
 * @param targetType - The type of target (e.g., "segment", "survey").
 * @param handler - The handler function to wrap.
 **/
export function withAuditLogging(
  actionType: TAuditAction,
  targetType: TAuditTarget,
  handler: (args: { ctx: any; parsedInput: any }) => Promise<any>
) {
  return async function wrappedAction(args: { ctx: any; parsedInput: any }) {
    const { ctx, parsedInput } = args;
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
        const userId: string = ctx.user.id;
        let organizationId = parsedInput?.organizationId || ctx?.organizationId;

        if (!organizationId) {
          const environmentId: string | undefined = parsedInput?.environmentId;
          if (environmentId) {
            organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
          } else {
            organizationId = "unknown";
          }
        }

        let targetId: string | undefined;
        switch (targetType) {
          case "segment":
            targetId = ctx?.segmentId;
            break;
          case "survey":
            targetId = ctx?.surveyId;
            break;
        }

        await buildAndLogAuditEvent({
          actionType: `${targetType}.${actionType}`,
          targetType,
          userId,
          userType: "user",
          targetId: targetId,
          organizationId,
          ipAddress: AUDIT_LOG_GET_USER_IP ? ctx?.ipAddress : "unknown",
          status,
          oldObject: ctx.oldObject,
          newObject: ctx.newObject,
          eventId: ctx.eventId,
        });
      } catch (logError) {
        logger.error(logError, "Failed to create audit log event");
      }
    });

    if (status === "failure") throw error;
    return result;
  };
}
