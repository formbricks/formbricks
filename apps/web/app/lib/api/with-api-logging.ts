import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import {
  AuthenticationMethod,
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

// Interface for handler function parameters
export interface THandlerParams<TProps = unknown> {
  req?: NextRequest;
  props?: TProps;
  auditLog?: TApiAuditLog;
  authentication?: TApiKeyAuthentication | TSessionAuthentication;
}

// Interface for wrapper function parameters
export interface TWithV1ApiWrapperParams<TResult extends { response: Response }, TProps = unknown> {
  handler: (params: THandlerParams<TProps>) => Promise<TResult>;
  action?: TAuditAction;
  targetType?: TAuditTarget;
}

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
  routeType: ApiV1RouteTypeEnum
): Promise<Response | null> => {
  try {
    if (authentication) {
      if ("user" in authentication) {
        // Session-based authentication for integration routes
        await applyRateLimit(rateLimitConfigs.api.v1, authentication.user.id);
      } else if ("hashedApiKey" in authentication) {
        // API key authentication for general routes
        await applyRateLimit(rateLimitConfigs.api.v1, authentication.hashedApiKey);
      } else {
        logger.error({ authentication }, "Unknown authentication type");
        return responses.internalServerErrorResponse("Invalid authentication configuration");
      }
    }

    if (routeType === ApiV1RouteTypeEnum.Client) {
      await applyClientRateLimit(url);
    }
  } catch (error) {
    return responses.tooManyRequestsResponse(error.message);
  }

  return null;
};

/**
 * Execute handler with error handling
 */
const executeHandler = async <TResult extends { response: Response }, TProps>(
  handler: (params: THandlerParams<TProps>) => Promise<TResult>,
  req: NextRequest,
  props: TProps,
  auditLog: TApiAuditLog | undefined,
  authentication: TApiV1Authentication
): Promise<{ result: TResult; error?: unknown }> => {
  try {
    const result = await handler({ req, props, auditLog, authentication });
    return { result };
  } catch (err) {
    const result = {
      response: responses.internalServerErrorResponse("An unexpected error occurred."),
    } as TResult;
    return { result, error: err };
  }
};

/**
 * Set up audit log with authentication details
 */
const setupAuditLog = (
  authentication: TApiV1Authentication,
  auditLog: TApiAuditLog | undefined,
  routeType: ApiV1RouteTypeEnum
): void => {
  if (
    authentication &&
    auditLog &&
    routeType === ApiV1RouteTypeEnum.General &&
    "apiKeyId" in authentication
  ) {
    auditLog.userId = authentication.apiKeyId;
    auditLog.organizationId = authentication.organizationId;
  }

  if (authentication && auditLog && "user" in authentication) {
    auditLog.userId = authentication.user.id;
  }
};

/**
 * Handle authentication based on method
 */
const handleAuthentication = async (
  authenticationMethod: AuthenticationMethod,
  req: NextRequest
): Promise<TApiV1Authentication> => {
  switch (authenticationMethod) {
    case AuthenticationMethod.ApiKey:
      return await authenticateRequest(req);
    case AuthenticationMethod.Session:
      return await getServerSession(authOptions);
    case AuthenticationMethod.Both: {
      const session = await getServerSession(authOptions);
      return session ?? (await authenticateRequest(req));
    }
    case AuthenticationMethod.None:
      return null;
  }
};

/**
 * Log error details to system logger and Sentry
 */
const logErrorDetails = (res: Response, req: NextRequest, correlationId: string, error?: any): void => {
  const logContext = {
    correlationId,
    method: req.method,
    path: req.url,
    status: res.status,
    ...(error && { error }),
  };

  logger.withContext(logContext).error("V1 API Error Details");

  if (SENTRY_DSN && IS_PRODUCTION && res.status >= 500) {
    const err = new Error(`API V1 error, id: ${correlationId}`);
    Sentry.captureException(err, { extra: { error, correlationId } });
  }
};

/**
 * Handle response processing and logging
 */
const processResponse = async (
  res: Response,
  req: NextRequest,
  auditLog?: TApiAuditLog,
  error?: any
): Promise<void> => {
  const correlationId = req.headers.get("x-request-id") ?? "";

  // Handle audit logging
  if (auditLog) {
    if (res.ok) {
      auditLog.status = "success";
    } else {
      auditLog.eventId = correlationId;
    }
  }

  // Handle error logging
  if (!res.ok) {
    logErrorDetails(res, req, correlationId, error);
  }

  // Queue audit event if enabled and audit log exists
  if (AUDIT_LOG_ENABLED && auditLog) {
    queueAuditEvent(auditLog);
  }
};

const getRouteType = (
  req: NextRequest
): { routeType: ApiV1RouteTypeEnum; isRateLimited: boolean; authenticationMethod: AuthenticationMethod } => {
  const pathname = req.nextUrl.pathname;

  const { isClientSideApi, isRateLimited } = isClientSideApiRoute(pathname);
  const { isManagementApi, authenticationMethod } = isManagementApiRoute(pathname);
  const isIntegration = isIntegrationRoute(pathname);

  if (isClientSideApi)
    return {
      routeType: ApiV1RouteTypeEnum.Client,
      isRateLimited,
      authenticationMethod: AuthenticationMethod.None,
    };
  if (isManagementApi)
    return { routeType: ApiV1RouteTypeEnum.General, isRateLimited: true, authenticationMethod };
  if (isIntegration)
    return {
      routeType: ApiV1RouteTypeEnum.Integration,
      isRateLimited: true,
      authenticationMethod: AuthenticationMethod.Session,
    };

  throw new Error(`Unknown route type: ${pathname}`);
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
 * @param params - Configuration object for the wrapper
 * @param params.handler - The API handler function that processes the request, receives an object with:
 *   - req: The incoming HTTP request object
 *   - props: Optional route parameters (e.g., { params: { id: string } })
 *   - auditLog: Optional audit log object for tracking API actions (only present when action/targetType provided)
 *   - authentication: Authentication result (type determined by route - API key for general, session for integration)
 * @param params.action - Optional audit action type (e.g., "created", "updated", "deleted"). Required for audit logging
 * @param params.targetType - Optional audit target type (e.g., "webhook", "survey", "response"). Required for audit logging
 * @returns Wrapped handler function that returns the final HTTP response
 *
 */
export const withV1ApiWrapper: {
  <TResult extends { response: Response }, TProps = unknown>(
    params: TWithV1ApiWrapperParams<TResult, TProps> & {
      handler: (
        params: THandlerParams<TProps> & { authentication?: TApiKeyAuthentication }
      ) => Promise<TResult>;
    }
  ): (req: NextRequest, props: TProps) => Promise<Response>;

  <TResult extends { response: Response }, TProps = unknown>(
    params: TWithV1ApiWrapperParams<TResult, TProps> & {
      handler: (
        params: THandlerParams<TProps> & { authentication?: TSessionAuthentication }
      ) => Promise<TResult>;
    }
  ): (req: NextRequest, props: TProps) => Promise<Response>;

  <TResult extends { response: Response }, TProps = unknown>(
    params: TWithV1ApiWrapperParams<TResult, TProps> & {
      handler: (
        params: THandlerParams<TProps> & { authentication?: TApiV1Authentication }
      ) => Promise<TResult>;
    }
  ): (req: NextRequest, props: TProps) => Promise<Response>;
} = <TResult extends { response: Response }, TProps = unknown>(
  params: TWithV1ApiWrapperParams<TResult, TProps>
): ((req: NextRequest, props: TProps) => Promise<Response>) => {
  const { handler, action, targetType } = params;
  return async (req: NextRequest, props: TProps): Promise<Response> => {
    // === Audit Log Setup ===
    const saveAuditLog = action && targetType;
    const auditLog = saveAuditLog ? buildAuditLogBaseObject(action, targetType, req.url) : undefined;

    let routeType: ApiV1RouteTypeEnum;
    let isRateLimited: boolean;
    let authenticationMethod: AuthenticationMethod;

    // === Route Classification ===
    try {
      ({ routeType, isRateLimited, authenticationMethod } = getRouteType(req));
    } catch (error) {
      logger.error({ error }, "Error getting route type");
      return responses.internalServerErrorResponse("An unexpected error occurred.");
    }

    // === Authentication ===
    const authentication = await handleAuthentication(authenticationMethod, req);

    if (!authentication && routeType !== ApiV1RouteTypeEnum.Client) {
      return responses.notAuthenticatedResponse();
    }

    // === Audit Log Enhancement ===
    setupAuditLog(authentication, auditLog, routeType);

    // === Rate Limiting ===
    if (isRateLimited) {
      const rateLimitResponse = await handleRateLimiting(req.nextUrl.pathname, authentication, routeType);
      if (rateLimitResponse) return rateLimitResponse;
    }

    // === Handler Execution ===
    const { result, error } = await executeHandler(handler, req, props, auditLog, authentication);
    const res = result.response;

    // === Response Processing & Logging ===
    await processResponse(res, req, auditLog, error);

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
