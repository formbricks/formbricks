import "server-only";
import { ApiKeyPermission } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError } from "@formbricks/types/errors";
import { verifyFeedbackRecordsGatewayToken } from "@/lib/jwt";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  authenticateApiKeyFromHeaders,
  getApiKeyFromHeaders,
  getFeedbackRecordsGatewayJwtFromHeaders,
} from "@/modules/api/lib/api-key-auth";
import { getProxySession } from "@/modules/auth/lib/proxy-session";
import { getFeedbackRecordDirectoryAuthContext } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getFeedbackRecordTenant } from "@/modules/hub/service";

const FEEDBACK_RECORDS_V3_PREFIX = "/api/v3/feedbackRecords";
const FEEDBACK_RECORDS_SDK_PREFIX = "/v1/feedback-records";
const FEEDBACK_RECORDS_AUTH_PREFIX = "/api/envoy-auth/feedback-records";
const ZFeedbackRecordId = z.string().uuid();
const HEADERS_TO_REMOVE_ON_ALLOW = "x-api-key,authorization,cookie";

type TFeedbackRecordsGatewayPermission = "read" | "write";
type TFeedbackRecordsGatewayOperation =
  | "list"
  | "create"
  | "bulkDelete"
  | "semanticSearch"
  | "retrieve"
  | "update"
  | "delete"
  | "retrieveSimilar";

type TParsedGatewayRoute = {
  operation: TFeedbackRecordsGatewayOperation;
  requiredPermission: TFeedbackRecordsGatewayPermission;
  recordId?: string;
  tenantSource: "query" | "body" | "recordLookup";
};

type TAuthenticatedGatewayPrincipal =
  | {
      type: "apiKey";
      authentication: TAuthenticationApiKey;
    }
  | {
      type: "user";
      userId: string;
      source: "session" | "jwt";
    };

type TGatewayAuthenticationResult =
  | { status: "authenticated"; principal: TAuthenticatedGatewayPrincipal }
  | { status: "invalid" }
  | { status: "missing" };

const apiKeyPermissionWeight: Record<ApiKeyPermission, number> = {
  read: 1,
  write: 2,
  manage: 3,
};

const gatewayPermissionToApiKeyPermissionWeight: Record<TFeedbackRecordsGatewayPermission, number> = {
  read: apiKeyPermissionWeight.read,
  write: apiKeyPermissionWeight.write,
};

const buildAllowResponse = (): Response =>
  new Response(null, {
    status: 200,
    headers: {
      "x-envoy-auth-headers-to-remove": HEADERS_TO_REMOVE_ON_ALLOW,
    },
  });

const buildStatusResponse = (status: number, message: string): Response =>
  new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });

const parseOriginalRequestMetadata = (
  request: NextRequest
): { method: string; url: URL } | { errorResponse: Response } => {
  const originalMethod = request.headers.get("method")?.toUpperCase();

  if (!originalMethod) {
    return {
      errorResponse: buildStatusResponse(400, "Missing original request metadata"),
    };
  }

  if (!request.nextUrl.pathname.startsWith(FEEDBACK_RECORDS_AUTH_PREFIX)) {
    return {
      errorResponse: buildStatusResponse(400, "Invalid FeedbackRecords auth request path"),
    };
  }

  try {
    const originalPathname = request.nextUrl.pathname.slice(FEEDBACK_RECORDS_AUTH_PREFIX.length) || "/";
    const originalPath = `${originalPathname}${request.nextUrl.search}`;

    return {
      method: originalMethod,
      url: new URL(originalPath, "https://feedback-records-gateway.local"),
    };
  } catch {
    return {
      errorResponse: buildStatusResponse(400, "Invalid original request path"),
    };
  }
};

const stripFeedbackRecordsPrefix = (pathname: string, prefix: string): string | null => {
  if (pathname === prefix) {
    return "/";
  }

  if (!pathname.startsWith(`${prefix}/`)) {
    return null;
  }

  return pathname.slice(prefix.length) || "/";
};

const normalizeFeedbackRecordsPath = (pathname: string): string | null => {
  const v3Path = stripFeedbackRecordsPrefix(pathname, FEEDBACK_RECORDS_V3_PREFIX);
  if (v3Path) {
    return v3Path;
  }

  const sdkPath = stripFeedbackRecordsPrefix(pathname, FEEDBACK_RECORDS_SDK_PREFIX);
  if (sdkPath) {
    return sdkPath;
  }

  return null;
};

const parseFeedbackRecordsGatewayRoute = (
  method: string,
  pathname: string
): TParsedGatewayRoute | null => {
  const normalizedPath = normalizeFeedbackRecordsPath(pathname);
  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath === "/") {
    switch (method) {
      case "GET":
        return { operation: "list", requiredPermission: "read", tenantSource: "query" };
      case "POST":
        return { operation: "create", requiredPermission: "write", tenantSource: "body" };
      case "DELETE":
        return { operation: "bulkDelete", requiredPermission: "write", tenantSource: "query" };
      default:
        return null;
    }
  }

  if (normalizedPath === "/search/semantic" && method === "POST") {
    return { operation: "semanticSearch", requiredPermission: "read", tenantSource: "body" };
  }

  const pathSegments = normalizedPath.split("/").filter(Boolean);
  if (pathSegments.length === 1) {
    const [recordId] = pathSegments;
    if (!ZFeedbackRecordId.safeParse(recordId).success) {
      return null;
    }

    switch (method) {
      case "GET":
        return { operation: "retrieve", requiredPermission: "read", tenantSource: "recordLookup", recordId };
      case "PATCH":
        return { operation: "update", requiredPermission: "write", tenantSource: "recordLookup", recordId };
      case "DELETE":
        return { operation: "delete", requiredPermission: "write", tenantSource: "recordLookup", recordId };
      default:
        return null;
    }
  }

  if (pathSegments.length === 2 && pathSegments[1] === "similar" && method === "GET") {
    const [recordId] = pathSegments;
    if (!ZFeedbackRecordId.safeParse(recordId).success) {
      return null;
    }

    return {
      operation: "retrieveSimilar",
      requiredPermission: "read",
      tenantSource: "query",
      recordId,
    };
  }

  return null;
};

const parseTenantId = (tenantId: string | null): string | null => {
  if (!tenantId) {
    return null;
  }

  return ZId.safeParse(tenantId).success ? tenantId : null;
};

const parseJsonBody = async (request: NextRequest): Promise<Record<string, unknown> | null> => {
  try {
    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return null;
    }

    const parsedBody = JSON.parse(rawBody);
    return parsedBody && typeof parsedBody === "object" ? (parsedBody as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const authenticateGatewayRequest = async (request: NextRequest): Promise<TGatewayAuthenticationResult> => {
  if (getApiKeyFromHeaders(request.headers)) {
    const apiKeyAuthentication = await authenticateApiKeyFromHeaders(request.headers);
    if (!apiKeyAuthentication) {
      return { status: "invalid" };
    }

    return {
      status: "authenticated",
      principal: {
        type: "apiKey",
        authentication: apiKeyAuthentication,
      },
    };
  }

  const feedbackRecordsGatewayJwt = getFeedbackRecordsGatewayJwtFromHeaders(request.headers);
  if (feedbackRecordsGatewayJwt) {
    try {
      const { userId } = verifyFeedbackRecordsGatewayToken(feedbackRecordsGatewayJwt);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });

      if (!user || user.isActive === false) {
        return { status: "invalid" };
      }

      return {
        status: "authenticated",
        principal: {
          type: "user",
          userId: user.id,
          source: "jwt",
        },
      };
    } catch {
      return { status: "invalid" };
    }
  }

  const proxySession = await getProxySession(request);
  if (!proxySession) {
    return { status: "missing" };
  }

  return {
    status: "authenticated",
    principal: {
      type: "user",
      userId: proxySession.userId,
      source: "session",
    },
  };
};

const hasFeedbackRecordDirectoryPermission = (
  authentication: TAuthenticationApiKey,
  feedbackRecordDirectoryId: string,
  requiredPermission: TFeedbackRecordsGatewayPermission
): boolean => {
  const feedbackRecordDirectoryPermission = authentication.feedbackRecordDirectoryPermissions.find(
    (permission) => permission.feedbackRecordDirectoryId === feedbackRecordDirectoryId
  );

  if (!feedbackRecordDirectoryPermission) {
    return false;
  }

  return (
    apiKeyPermissionWeight[feedbackRecordDirectoryPermission.permission] >=
    gatewayPermissionToApiKeyPermissionWeight[requiredPermission]
  );
};

const resolveTenantId = async (
  request: NextRequest,
  route: TParsedGatewayRoute,
  originalUrl: URL,
  requestId: string
): Promise<{ tenantId: string } | { errorResponse: Response }> => {
  if (route.tenantSource === "query") {
    const tenantId = parseTenantId(originalUrl.searchParams.get("tenant_id"));
    if (!tenantId) {
      return {
        errorResponse: buildStatusResponse(400, "Invalid or missing tenant_id"),
      };
    }

    return { tenantId };
  }

  if (route.tenantSource === "body") {
    const body = await parseJsonBody(request);
    const tenantId = parseTenantId(typeof body?.tenant_id === "string" ? body.tenant_id : null);
    if (!tenantId) {
      return {
        errorResponse: buildStatusResponse(400, "Invalid or missing tenant_id"),
      };
    }

    return { tenantId };
  }

  const tenantLookup = await getFeedbackRecordTenant(route.recordId!);
  if (tenantLookup.error) {
    if (tenantLookup.error.status === 404) {
      logger.warn({ requestId, recordId: route.recordId }, "Feedback record tenant lookup returned not found");
      return {
        errorResponse: buildStatusResponse(403, "Forbidden"),
      };
    }

    logger.warn(
      { requestId, recordId: route.recordId, hubStatus: tenantLookup.error.status },
      "Feedback record tenant lookup failed"
    );
    return {
      errorResponse: buildStatusResponse(503, "Feedback record lookup failed"),
    };
  }

  const tenantId = parseTenantId(tenantLookup.data?.tenantId ?? null);
  if (!tenantId) {
    logger.warn({ requestId, recordId: route.recordId }, "Feedback record tenant lookup returned invalid tenant");
    return {
      errorResponse: buildStatusResponse(503, "Feedback record lookup failed"),
    };
  }

  return { tenantId };
};

const authorizeGatewayRequest = async (
  principal: TAuthenticatedGatewayPrincipal,
  feedbackRecordDirectoryId: string,
  requiredPermission: TFeedbackRecordsGatewayPermission
): Promise<{ allowed: true } | { allowed: false }> => {
  const feedbackRecordDirectory = await getFeedbackRecordDirectoryAuthContext(feedbackRecordDirectoryId);
  if (!feedbackRecordDirectory || feedbackRecordDirectory.isArchived) {
    return { allowed: false };
  }

  if (principal.type === "apiKey") {
    return hasFeedbackRecordDirectoryPermission(
      principal.authentication,
      feedbackRecordDirectoryId,
      requiredPermission
    )
      ? { allowed: true }
      : { allowed: false };
  }

  try {
    const minPermission: "read" | "readWrite" =
      requiredPermission === "read" ? "read" : "readWrite";

    await checkAuthorizationUpdated({
      userId: principal.userId,
      organizationId: feedbackRecordDirectory.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        ...feedbackRecordDirectory.workspaceIds.map((workspaceId) => ({
          type: "workspaceTeam" as const,
          workspaceId,
          minPermission,
        })),
      ],
    });

    return { allowed: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { allowed: false };
    }

    throw error;
  }
};

export const authorizeFeedbackRecordsGatewayRequest = async (request: NextRequest): Promise<Response> => {
  const requestId = request.headers.get("x-request-id") ?? "unknown";
  const originalRequestMetadata = parseOriginalRequestMetadata(request);
  if ("errorResponse" in originalRequestMetadata) {
    return originalRequestMetadata.errorResponse;
  }

  const route = parseFeedbackRecordsGatewayRoute(
    originalRequestMetadata.method,
    originalRequestMetadata.url.pathname
  );
  if (!route) {
    return buildStatusResponse(400, "Unsupported FeedbackRecords route");
  }

  const authenticationResult = await authenticateGatewayRequest(request);
  if (authenticationResult.status === "missing" || authenticationResult.status === "invalid") {
    logger.info(
      {
        requestId,
        operation: route.operation,
        verdict: "deny",
        reason: authenticationResult.status === "missing" ? "missing_auth" : "invalid_auth",
      },
      "Feedback records gateway authorization denied"
    );
    return buildStatusResponse(401, "Unauthorized");
  }

  const tenantResolution = await resolveTenantId(request, route, originalRequestMetadata.url, requestId);
  if ("errorResponse" in tenantResolution) {
    return tenantResolution.errorResponse;
  }

  const authorizationResult = await authorizeGatewayRequest(
    authenticationResult.principal,
    tenantResolution.tenantId,
    route.requiredPermission
  );
  if (!authorizationResult.allowed) {
    logger.info(
      {
        requestId,
        principalType: authenticationResult.principal.type,
        operation: route.operation,
        feedbackRecordDirectoryId: tenantResolution.tenantId,
        verdict: "deny",
      },
      "Feedback records gateway authorization denied"
    );
    return buildStatusResponse(403, "Forbidden");
  }

  logger.info(
    {
      requestId,
      principalType: authenticationResult.principal.type,
      operation: route.operation,
      feedbackRecordDirectoryId: tenantResolution.tenantId,
      verdict: "allow",
    },
    "Feedback records gateway authorization allowed"
  );

  return buildAllowResponse();
};
