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
  UNKNOWN_DATA,
} from "@/modules/ee/audit-logs/types/audit-log";
import { logger } from "@formbricks/logger";
import { runAuditLogHashTransaction } from "./cache";
import { computeAuditLogHash, deepDiff, redactPII } from "./utils";

/**
 * Builds an audit event and logs it.
 * Redacts sensitive data from the old and new objects and computes the hash of the event before logging it.
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

    await runAuditLogHashTransaction(async (previousHash) => {
      const isChainStart = !previousHash;
      const integrityHash = computeAuditLogHash(eventBase, previousHash);
      const auditEvent: TAuditLogEvent = {
        ...eventBase,
        integrityHash,
        previousHash,
        ...(isChainStart ? { chainStart: true } : {}),
      };
      return {
        auditEvent: async () => await logAuditEvent(auditEvent),
        integrityHash,
      };
    });
  } catch (logError) {
    logger.error(logError, "Failed to create audit log event");
  }
};

/**
 * Logs an audit event.
 * The audit logging runs in the background to avoid blocking the main request.
 */
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
 */
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

/**
 * Wraps a handler function with audit logging.
 * Logs audit events for server actions. Specifically for server actions that use next-server-action library middleware and its context.
 * The audit logging runs in the background to avoid blocking the main request.
 *
 * @param action - The type of action to audit.
 * @param targetType - The type of target (e.g., "segment", "survey").
 * @param handler - The handler function to wrap.
 **/
export const withAuditLogging = (
  action: TAuditAction,
  targetType: TAuditTarget,
  handler: (args: { ctx: any; parsedInput: any }) => Promise<any>
) => {
  return async function wrappedAction(args: { ctx: any; parsedInput: any }) {
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
      if (status === "failure") throw error;
      return result;
    }

    if (!auditLoggingCtx) {
      // This is to signal that the audit logging context is not available when it is expected to be available. But we don't want to throw an error here.
      logger.error("No audit logging context found");
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
          case "organization":
            targetId = auditLoggingCtx?.organizationId ?? UNKNOWN_DATA;
            break;
          case "tag":
            targetId = auditLoggingCtx?.tagId ?? UNKNOWN_DATA;
            break;
          case "webhook":
            targetId = auditLoggingCtx?.webhookId ?? UNKNOWN_DATA;
            break;
          case "user":
            targetId = auditLoggingCtx?.userId ?? UNKNOWN_DATA;
            break;
          case "project":
            targetId = auditLoggingCtx?.projectId ?? UNKNOWN_DATA;
            break;
          case "language":
            targetId = auditLoggingCtx?.languageId ?? UNKNOWN_DATA;
            break;
          case "invite":
            targetId = auditLoggingCtx?.inviteId ?? UNKNOWN_DATA;
            break;
          case "membership":
            targetId = auditLoggingCtx?.membershipId ?? UNKNOWN_DATA;
            break;
          case "actionClass":
            targetId = auditLoggingCtx?.actionClassId ?? UNKNOWN_DATA;
            break;
          case "contact":
            targetId = auditLoggingCtx?.contactId ?? UNKNOWN_DATA;
            break;
          case "apiKey":
            targetId = auditLoggingCtx?.apiKeyId ?? UNKNOWN_DATA;
            break;
          case "response":
            targetId = auditLoggingCtx?.responseId ?? UNKNOWN_DATA;
            break;
          case "responseNote":
            targetId = auditLoggingCtx?.responseNoteId ?? UNKNOWN_DATA;
            break;
          default:
            targetId = UNKNOWN_DATA;
            break;
        }

        await buildAndLogAuditEvent({
          actionType: `${targetType}.${action}`,
          targetType,
          userId,
          userType: "user",
          targetId,
          organizationId,
          ipAddress: AUDIT_LOG_GET_USER_IP ? auditLoggingCtx?.ipAddress : UNKNOWN_DATA,
          status,
          oldObject: auditLoggingCtx?.oldObject,
          newObject: auditLoggingCtx?.newObject,
          eventId: auditLoggingCtx?.eventId,
        });
      } catch (logError) {
        logger.error(logError, "Failed to create audit log event");
      }
    });

    if (status === "failure") throw error;
    return result;
  };
};
