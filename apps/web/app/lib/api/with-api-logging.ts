import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import {
  isClientSideApiRoute,
  isIntegrationRoute,
  isManagementApiRoute,
  isSyncWithUserIdentificationEndpoint,
} from "@/app/middleware/endpoint-validator";
import { AUDIT_LOG_ENABLED, IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditAction, TAuditTarget, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import * as Sentry from "@sentry/nextjs";
import { Session, getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";

export type TApiAuditLog = Parameters<typeof queueAuditEvent>[0];
export type TApiV1Authentication = TAuthenticationApiKey | Session | null;
export type TApiKeyAuthentication = TAuthenticationApiKey | null;
export type TSessionAuthentication = Session | null;

enum ApiV1RouteTypeEnum {
  Client = "client",
  General = "general",
  Integration = "integration",
}

/**
 * Apply client-side API rate limiting (IP-based or sync-specific)
 */
const applyClientRateLimit = async (url: string): Promise<void> => {
  const syncEndpoint = isSyncWithUserIdentificationEndpoint(url);
  if (syncEndpoint) {
    const syncRateLimitConfig = rateLimitConfigs.api.syncUserIdentification;
    await applyRateLimit(syncRateLimitConfig, syncEndpoint.userId);
  } else {
    await applyIPRateLimit(rateLimitConfigs.api.client);
  }
};

/**
 * Handle rate limiting based on authentication and API type
 */
const handleRateLimiting = async (
  url: string,
  authentication: TApiV1Authentication,
  isClientSideApi: boolean,
  routeType: ApiV1RouteTypeEnum
): Promise<Response | null> => {
  try {
    if (authentication) {
      if (routeType === ApiV1RouteTypeEnum.Integration && "user" in authentication) {
        // Session-based authentication for integration routes
        await applyRateLimit(rateLimitConfigs.api.v1, authentication.user.id);
      } else if ("hashedApiKey" in authentication) {
        // API key authentication for general routes
        await applyRateLimit(rateLimitConfigs.api.v1, authentication.hashedApiKey);
      }
    }

    if (isClientSideApi) {
      await applyClientRateLimit(url);
    }
  } catch (error) {
    return responses.tooManyRequestsResponse(error.message);
  }

  return null;
};

/**
 * Handle response processing and logging
 */
const processResponse = async (
  res: Response,
  req: Request,
  auditLog: TApiAuditLog,
  error?: any
): Promise<void> => {
  let isSuccess = false;
  try {
    const parsed = await res.clone().json();
    isSuccess = parsed && typeof parsed === "object" && "data" in parsed;
  } catch {
    isSuccess = false;
  }

  const correlationId = req.headers.get("x-request-id") ?? "";

  if (!isSuccess) {
    if (auditLog) {
      auditLog.eventId = correlationId;
    }

    const logContext: any = {
      correlationId,
      method: req.method,
      path: req.url,
      status: res.status,
    };
    if (error) {
      logContext.error = error;
    }
    logger.withContext(logContext).error("V1 API Error Details");

    if (SENTRY_DSN && IS_PRODUCTION && res.status === 500) {
      const err = new Error(`API V1 error, id: ${correlationId}`);
      Sentry.captureException(err, {
        extra: {
          error,
          correlationId,
        },
      });
    }
  } else {
    auditLog.status = "success";
  }

  if (AUDIT_LOG_ENABLED && auditLog) {
    queueAuditEvent(auditLog);
  }
};

const getRouteType = (url: string): ApiV1RouteTypeEnum => {
  if (isClientSideApiRoute(url)) return ApiV1RouteTypeEnum.Client;
  if (isManagementApiRoute(url)) return ApiV1RouteTypeEnum.General;
  if (isIntegrationRoute(url)) return ApiV1RouteTypeEnum.Integration;
  return ApiV1RouteTypeEnum.Client;
};

/**
 * withV1ApiWrapper wraps a V1 API handler to provide unified authentication, rate limiting, and optional audit/system logging.
 *
 * Features:
 * - Performs authentication once and passes result to handler
 * - Applies API key-based rate limiting with differentiated limits for client vs management APIs
 * - Includes additional sync user identification rate limiting for client-side sync endpoints
 * - Sets userId and organizationId in audit log automatically when audit logging is enabled
 * - System and Sentry logs are always called for non-success responses
 * - Uses function overloads to provide type safety without requiring type guards
 *
 * @param handler - The API handler function that processes the request
 * @param handler.req - The incoming HTTP request object
 * @param handler.props - Optional route parameters (e.g., { params: { id: string } })
 * @param handler.auditLog - Optional audit log object for tracking API actions (only present when action/targetType provided)
 * @param handler.authentication - Authentication result (type determined by route - API key for general, session for integration)
 * @param action - Optional audit action type (e.g., "created", "updated", "deleted"). Required for audit logging
 * @param targetType - Optional audit target type (e.g., "webhook", "survey", "response"). Required for audit logging
 * @returns Wrapped handler function that returns the final HTTP response
 *
 */
export const withV1ApiWrapper: {
  <TResult extends { response: Response }, TProps = unknown>(
    handler: (
      req: Request | NextRequest,
      props?: TProps,
      auditLog?: TApiAuditLog,
      authentication?: TApiKeyAuthentication
    ) => Promise<TResult>,
    action?: TAuditAction,
    targetType?: TAuditTarget
  ): (req: Request, props: TProps) => Promise<Response>;

  <TResult extends { response: Response }, TProps = unknown>(
    handler: (
      req: Request | NextRequest,
      props?: TProps,
      auditLog?: TApiAuditLog,
      authentication?: TSessionAuthentication
    ) => Promise<TResult>,
    action?: TAuditAction,
    targetType?: TAuditTarget
  ): (req: Request, props: TProps) => Promise<Response>;
} = <TResult extends { response: Response }, TProps = unknown>(
  handler: (
    req: Request | NextRequest,
    props?: TProps,
    auditLog?: TApiAuditLog,
    authentication?: any // Must use 'any' for overload compatibility
  ) => Promise<TResult>,
  action?: TAuditAction,
  targetType?: TAuditTarget
): ((req: Request, props: TProps) => Promise<Response>) => {
  return async (req: Request, props: TProps): Promise<Response> => {
    const saveAuditLog = action && targetType;
    const auditLog = saveAuditLog ? buildAuditLogBaseObject(action, targetType, req.url) : undefined;

    let result: { response: Response };
    let error: any = undefined;

    const routeType = getRouteType(req.url);
    const authentication =
      routeType === ApiV1RouteTypeEnum.Integration
        ? await getServerSession(authOptions)
        : await authenticateRequest(req);
    const { isClientSideApi, isRateLimited } = isClientSideApiRoute(req.url);

    if (!authentication && !isClientSideApi) {
      return responses.notAuthenticatedResponse();
    }

    if (
      authentication &&
      auditLog &&
      routeType === ApiV1RouteTypeEnum.General &&
      "apiKeyId" in authentication
    ) {
      auditLog.userId = authentication.apiKeyId;
      auditLog.organizationId = authentication.organizationId;
    }

    if (isRateLimited) {
      const rateLimitResponse = await handleRateLimiting(req.url, authentication, isClientSideApi, routeType);
      if (rateLimitResponse) return rateLimitResponse;
    }

    try {
      result = await handler(req, props, auditLog, authentication);
    } catch (err) {
      error = err;
      result = {
        response: responses.internalServerErrorResponse("An unexpected error occurred."),
      };
    }

    const res = result.response;
    if (auditLog) {
      await processResponse(res, req, auditLog, error);
    }
    return res;
  };
};

export const buildAuditLogBaseObject = (
  action: TAuditAction,
  targetType: TAuditTarget,
  apiUrl: string
): TApiAuditLog => {
  return {
    action,
    targetType,
    userId: UNKNOWN_DATA,
    targetId: UNKNOWN_DATA,
    organizationId: UNKNOWN_DATA,
    status: "failure",
    oldObject: undefined,
    newObject: undefined,
    userType: "api",
    apiUrl,
  };
};
