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
}) {
  try {
    let changes;
    if (oldObject && newObject) {
      changes = deepDiff(oldObject, newObject);
    } else if (newObject) {
      changes = newObject;
    } else if (oldObject) {
      changes = oldObject;
    }

    const auditEvent: TAuditLogEvent = {
      actor: { id: userId, type: userType },
      action: { type: actionType },
      target: { id: targetId, type: targetType },
      timestamp: new Date().toISOString(),
      organizationId,
      status,
      ipAddress,
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
 *
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
 *
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

    setImmediate(async () => {
      try {
        const userId: string = ctx.user.id;
        let organizationId = parsedInput?.organizationId || ctx?.organizationId;

        if (!organizationId) {
          const environmentId: string | undefined = parsedInput?.environmentId;
          if (environmentId) {
            organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
          } else {
            organizationId = "anonymous";
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

        const ipAddress = ctx?.ipAddress ?? "anonymous";
        await buildAndLogAuditEvent({
          actionType: `${targetType}.${actionType}`,
          targetType,
          userId,
          userType: "user",
          targetId: targetId,
          organizationId,
          ipAddress,
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
