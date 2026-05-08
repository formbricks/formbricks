import { Session, getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { authenticateRequest } from "@/app/api/v1/auth";
import { reportApiError } from "@/app/lib/api/api-error-reporter";
import { responses } from "@/app/lib/api/response";
import {
  AuthenticationMethod,
  isClientSideApiRoute,
  isIntegrationRoute,
  isManagementApiRoute,
} from "@/app/middleware/endpoint-validator";
import { AUDIT_LOG_ENABLED } from "@/lib/constants";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditAction, TAuditTarget, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

export type TApiAuditLog = Parameters<typeof queueAuditEvent>[0];
export type TApiV1Authentication = TAuthenticationApiKey | Session | null;
export type TApiKeyAuthentication = TAuthenticationApiKey | null;
export type TSessionAuthentication = Session | null;

// Interface for handler function parameters
export interface THandlerParams<TProps = unknown> {
  req: NextRequest;
  props: TProps;
  auditLog?: TApiAuditLog;
  authentication?: TApiV1Authentication;
}

// Interface for wrapper function parameters
export interface TWithV1ApiWrapperParams<
  TResult extends { response: Response; error?: unknown },
  TProps = unknown,
> {
  handler: (params: THandlerParams<TProps>) => Promise<TResult>;
  action?: TAuditAction;
  targetType?: TAuditTarget;
  customRateLimitConfig?: TRateLimitConfig;
  /**
   * When the route requires auth but the client is unauthenticated, the wrapper normally returns
   * the legacy JSON 401. Use this to return a custom response (e.g. RFC 9457 problem+json for V3).
   */
  unauthenticatedResponse?: (req: NextRequest) => Response;
  /**
   * Most v1 management routes are environment-scoped. Enable this only for routes that explicitly
   * support organization-only API keys.
   */
  allowOrganizationOnlyApiKey?: boolean;
}

enum ApiV1RouteTypeEnum {
  Client = "client",
  General = "general",
  Integration = "integration",
}

/**
 * Apply client-side API rate limiting (IP-based)
 */
const applyClientRateLimit = async (customRateLimitConfig?: TRateLimitConfig): Promise<void> => {
  await applyIPRateLimit(customRateLimitConfig ?? rateLimitConfigs.api.client);
};

/**
 * Handle rate limiting based on authentication and API type
 */
const handleRateLimiting = async (
  authentication: TApiV1Authentication,
  routeType: ApiV1RouteTypeEnum,
  customRateLimitConfig?: TRateLimitConfig
): Promise<Response | null> => {
  try {
    if (authentication) {
      if ("user" in authentication) {
        // Session-based authentication for integration routes
        await applyRateLimit(customRateLimitConfig ?? rateLimitConfigs.api.v1, authentication.user.id);
      } else if ("apiKeyId" in authentication) {
        // API key authentication for general routes
        await applyRateLimit(customRateLimitConfig ?? rateLimitConfigs.api.v1, authentication.apiKeyId);
      } else {
        logger.error({ authentication }, "Unknown authentication type");
        return responses.internalServerErrorResponse("Invalid authentication configuration");
      }
    }

    if (routeType === ApiV1RouteTypeEnum.Client) {
      await applyClientRateLimit(customRateLimitConfig);
    }
  } catch (error) {
    return responses.tooManyRequestsResponse(error instanceof Error ? error.message : "Rate limit exceeded");
  }

  return null;
};

/**
 * Execute handler with error handling
 */
const executeHandler = async <TResult extends { response: Response; error?: unknown }, TProps>(
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
  req: NextRequest,
  allowOrganizationOnlyApiKey = false
): Promise<TApiV1Authentication> => {
  switch (authenticationMethod) {
    case AuthenticationMethod.ApiKey:
      return await authenticateRequest(req, { allowOrganizationOnlyApiKey });
    case AuthenticationMethod.Session:
      return await getServerSession(authOptions);
    case AuthenticationMethod.Both: {
      const session = await getServerSession(authOptions);
      return session ?? (await authenticateRequest(req, { allowOrganizationOnlyApiKey }));
    }
    case AuthenticationMethod.None:
      return null;
  }
};

/**
 * Log error details to system logger and Sentry
 */
const logErrorDetails = (res: Response, req: NextRequest, error?: unknown): void => {
  reportApiError({
    request: req,
    status: res.status,
    error,
  });
};

/**
 * Handle response processing and logging
 */
const processResponse = async (
  res: Response,
  req: NextRequest,
  auditLog?: TApiAuditLog,
  error?: unknown
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
    logErrorDetails(res, req, error);
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
export const withV1ApiWrapper = <TResult extends { response: Response; error?: unknown }, TProps = unknown>(
  params: TWithV1ApiWrapperParams<TResult, TProps>
): ((req: NextRequest, props: TProps) => Promise<Response>) => {
  const {
    handler,
    action,
    targetType,
    customRateLimitConfig,
    unauthenticatedResponse,
    allowOrganizationOnlyApiKey,
  } = params;
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
    const authentication = await handleAuthentication(authenticationMethod, req, allowOrganizationOnlyApiKey);

    if (!authentication && routeType !== ApiV1RouteTypeEnum.Client) {
      if (unauthenticatedResponse) {
        const res = unauthenticatedResponse(req);
        await processResponse(res, req, auditLog);
        return res;
      }
      return responses.notAuthenticatedResponse();
    }

    // === Audit Log Enhancement ===
    setupAuditLog(authentication, auditLog, routeType);

    // === Rate Limiting ===
    if (isRateLimited) {
      const rateLimitResponse = await handleRateLimiting(authentication, routeType, customRateLimitConfig);
      if (rateLimitResponse) return rateLimitResponse;
    }

    // === Handler Execution ===
    const { result, error } = await executeHandler(handler, req, props, auditLog, authentication);
    const res = result.response;
    const reportedError = result.error ?? error;

    // === Response Processing & Logging ===
    await processResponse(res, req, auditLog, reportedError);

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
