import { AUDIT_LOG_ENABLED, AUDIT_LOG_GET_USER_IP } from "@/lib/constants";
import { ActionClientCtx, AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { logAuditEvent } from "@/modules/ee/audit-logs/lib/service";
import {
  TActor,
  TAuditAction,
  TAuditLogEvent,
  TAuditStatus,
  TAuditTarget,
  UNKNOWN_DATA,
} from "@/modules/ee/audit-logs/types/audit-log";
import { getIsAuditLogsEnabled } from "@/modules/ee/license-check/lib/utils";
import { logger } from "@formbricks/logger";
import { deepDiff, redactPII } from "./utils";

/**
 * Builds an audit event and logs it.
 * Redacts sensitive data from the old and new objects before logging.
 */
export const buildAndLogAuditEvent = async ({
  action,
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
  action: TAuditAction;
  targetType: TAuditTarget;
  userId: string;
  userType: TActor;
  targetId: string;
  organizationId: string;
  ipAddress: string;
  status: TAuditStatus;
  oldObject?: Record<string, unknown> | null;
  newObject?: Record<string, unknown> | null;
  eventId?: string;
  apiUrl?: string;
}) => {
  if (!AUDIT_LOG_ENABLED && !(await getIsAuditLogsEnabled())) {
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
      action,
      target: { id: targetId, type: targetType },
      timestamp: new Date().toISOString(),
      organizationId,
      status,
      ipAddress: AUDIT_LOG_GET_USER_IP ? ipAddress : UNKNOWN_DATA,
      apiUrl,
      ...(changes ? { changes } : {}),
      ...(status === "failure" && eventId ? { eventId } : {}),
    };

    await logAuditEvent(auditEvent);
  } catch (logError) {
    logger.error(logError, "Failed to create audit log event");
  }
};

/**
 * Logs an audit event.
 * The audit logging runs in the background to avoid blocking the main request.
 */
export const queueAuditEventBackground = async ({
  action,
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
  action: TAuditAction;
  targetType: TAuditTarget;
  userId: string;
  userType: TActor;
  targetId: string;
  organizationId: string;
  oldObject?: Record<string, unknown> | null;
  newObject?: Record<string, unknown> | null;
  status: TAuditStatus;
  eventId?: string;
  apiUrl?: string;
}) => {
  setImmediate(async () => {
    const ipAddress = await getClientIpFromHeaders();
    await buildAndLogAuditEvent({
      action,
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
 */
export const queueAuditEvent = async ({
  action,
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
  action: TAuditAction;
  targetType: TAuditTarget;
  userId: string;
  userType: TActor;
  targetId: string;
  organizationId: string;
  oldObject?: Record<string, unknown> | null;
  newObject?: Record<string, unknown> | null;
  status: TAuditStatus;
  eventId?: string;
  apiUrl?: string;
}) => {
  const ipAddress = await getClientIpFromHeaders();

  await buildAndLogAuditEvent({
    action,
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

/**
 * Wraps a handler function with audit logging.
 * Logs audit events for server actions. Specifically for server actions that use next-server-action library middleware and its context.
 * The audit logging runs in the background to avoid blocking the main request.
 *
 * @param action - The type of action to audit.
 * @param targetType - The type of target (e.g., "segment", "survey").
 * @param handler - The handler function to wrap. It can be used with both authenticated and unauthenticated actions.
 **/
export const withAuditLogging = <TParsedInput = Record<string, unknown>, TResult = unknown>(
  action: TAuditAction,
  targetType: TAuditTarget,
  handler: (args: {
    ctx: ActionClientCtx | AuthenticatedActionClientCtx;
    parsedInput: TParsedInput;
  }) => Promise<TResult>
) => {
  return async function wrappedAction(args: {
    ctx: ActionClientCtx | AuthenticatedActionClientCtx;
    parsedInput: TParsedInput;
  }): Promise<TResult> {
    const { ctx, parsedInput } = args;
    const { auditLoggingCtx } = ctx;
    let result!: TResult;
    let status: TAuditStatus = "success";
    let error: any = undefined;

    try {
      result = await handler(args);
    } catch (err) {
      status = "failure";
      error = err;
    }

    if (!AUDIT_LOG_ENABLED) {
      if (status === "failure") throw error;
      return result;
    }

    if (!auditLoggingCtx) {
      logger.error("No audit logging context found");
      return result;
    }

    setImmediate(async () => {
      try {
        const userId: string = ctx?.user?.id ?? UNKNOWN_DATA;
        let organizationId =
          auditLoggingCtx?.organizationId || // NOSONAR // We want to use the organizationId from the auditLoggingCtx if it is present and not empty
          (parsedInput as Record<string, any>)?.organizationId || // NOSONAR // We want to use the organizationId from the parsedInput if it is present and not empty
          UNKNOWN_DATA;

        if (!organizationId) {
          const environmentId = (parsedInput as Record<string, any>)?.environmentId;
          if (environmentId && typeof environmentId === "string") {
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

        let targetId: string | undefined;
        switch (targetType) {
          case "segment":
            targetId = auditLoggingCtx.segmentId;
            break;
          case "survey":
            targetId = auditLoggingCtx.surveyId;
            break;
          case "organization":
            targetId = auditLoggingCtx.organizationId;
            break;
          case "tag":
            targetId = auditLoggingCtx.tagId;
            break;
          case "webhook":
            targetId = auditLoggingCtx.webhookId;
            break;
          case "user":
            targetId = auditLoggingCtx.userId;
            break;
          case "project":
            targetId = auditLoggingCtx.projectId;
            break;
          case "language":
            targetId = auditLoggingCtx.languageId;
            break;
          case "invite":
            targetId = auditLoggingCtx.inviteId;
            break;
          case "membership":
            targetId = auditLoggingCtx.membershipId;
            break;
          case "actionClass":
            targetId = auditLoggingCtx.actionClassId;
            break;
          case "contact":
            targetId = auditLoggingCtx.contactId;
            break;
          case "apiKey":
            targetId = auditLoggingCtx.apiKeyId;
            break;
          case "response":
            targetId = auditLoggingCtx.responseId;
            break;
          case "responseNote":
            targetId = auditLoggingCtx.responseNoteId;
            break;
          case "integration":
            targetId = auditLoggingCtx.integrationId;
            break;
          default:
            targetId = UNKNOWN_DATA;
            break;
        }

        targetId ??= UNKNOWN_DATA;

        await buildAndLogAuditEvent({
          action,
          targetType,
          userId,
          userType: "user",
          targetId,
          organizationId,
          ipAddress: AUDIT_LOG_GET_USER_IP ? auditLoggingCtx.ipAddress : UNKNOWN_DATA,
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
