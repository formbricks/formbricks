import "server-only";
import { ApiKeyPermission } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError } from "@formbricks/types/errors";
import { verifyFeedbackRecordsGatewayToken } from "@/lib/jwt";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getBearerTokenFromHeaders } from "@/modules/api/lib/api-key-auth";
import { getFeedbackDirectoryAuthContext } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsUnifyFeedbackEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  TGatewayAuthenticatedPrincipal,
  TGatewayRequestAuthorizer,
  allowGatewayRequest,
  buildGatewayStatusResponse,
} from "@/modules/gateway-auth/lib/request";
import { getFeedbackRecordTenant } from "@/modules/hub/service";

const FEEDBACK_RECORDS_V3_PREFIX = "/api/v3/feedbackRecords";
const FEEDBACK_RECORDS_SDK_PREFIX = "/v1/feedback-records";
const ZFeedbackRecordId = z.uuid();

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

const apiKeyPermissionWeight: Record<ApiKeyPermission, number> = {
  read: 1,
  write: 2,
  manage: 3,
};

const gatewayPermissionToApiKeyPermissionWeight: Record<TFeedbackRecordsGatewayPermission, number> = {
  read: apiKeyPermissionWeight.read,
  write: apiKeyPermissionWeight.write,
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

const parseFeedbackRecordsGatewayRoute = (method: string, pathname: string): TParsedGatewayRoute | null => {
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

type TAuthenticatedGatewayPrincipal = TGatewayAuthenticatedPrincipal;

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

const getFeedbackRecordsGatewayJwtFromHeaders = (headers: Headers): string | null => {
  return getBearerTokenFromHeaders(headers);
};

const hasApiKeyImplicitFeedbackDirectoryAccess = (
  authentication: TAuthenticationApiKey,
  workspaceIds: string[],
  requiredPermission: TFeedbackRecordsGatewayPermission
): boolean => {
  const orgAccessControl = authentication.organizationAccess?.accessControl;
  if (orgAccessControl?.write) {
    return true;
  }
  if (orgAccessControl?.read && requiredPermission === "read") {
    return true;
  }

  const matchingWeights = authentication.workspacePermissions
    .filter((permission) => workspaceIds.includes(permission.workspaceId))
    .map((permission) => apiKeyPermissionWeight[permission.permission]);

  if (matchingWeights.length === 0) {
    return false;
  }

  const maxWeight = Math.max(...matchingWeights);
  return maxWeight >= gatewayPermissionToApiKeyPermissionWeight[requiredPermission];
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
        errorResponse: buildGatewayStatusResponse(400, "Invalid or missing tenant_id"),
      };
    }

    return { tenantId };
  }

  if (route.tenantSource === "body") {
    const body = await parseJsonBody(request);
    const tenantId = parseTenantId(typeof body?.tenant_id === "string" ? body.tenant_id : null);
    if (!tenantId) {
      return {
        errorResponse: buildGatewayStatusResponse(400, "Invalid or missing tenant_id"),
      };
    }

    return { tenantId };
  }

  const tenantLookup = await getFeedbackRecordTenant(route.recordId!);
  if (tenantLookup.error) {
    if (tenantLookup.error.status === 404) {
      logger.warn(
        { requestId, recordId: route.recordId },
        "Feedback record tenant lookup returned not found"
      );
      return {
        errorResponse: buildGatewayStatusResponse(403, "Forbidden"),
      };
    }

    logger.warn(
      { requestId, recordId: route.recordId, hubStatus: tenantLookup.error.status },
      "Feedback record tenant lookup failed"
    );
    return {
      errorResponse: buildGatewayStatusResponse(503, "Feedback record lookup failed"),
    };
  }

  const tenantId = parseTenantId(tenantLookup.data?.tenantId ?? null);
  if (!tenantId) {
    logger.warn(
      { requestId, recordId: route.recordId },
      "Feedback record tenant lookup returned invalid tenant"
    );
    return {
      errorResponse: buildGatewayStatusResponse(503, "Feedback record lookup failed"),
    };
  }

  return { tenantId };
};

const authorizeFeedbackRecordsGatewayRequest = async (
  principal: TAuthenticatedGatewayPrincipal,
  feedbackDirectoryId: string,
  requiredPermission: TFeedbackRecordsGatewayPermission
): Promise<{ allowed: true } | { allowed: false }> => {
  const feedbackDirectory = await getFeedbackDirectoryAuthContext(feedbackDirectoryId);
  if (!feedbackDirectory || feedbackDirectory.isArchived) {
    return { allowed: false };
  }

  const isUnifyFeedbackAllowed = await getIsUnifyFeedbackEnabled(feedbackDirectory.organizationId);
  if (!isUnifyFeedbackAllowed) {
    return { allowed: false };
  }

  if (principal.type === "apiKey") {
    return hasApiKeyImplicitFeedbackDirectoryAccess(
      principal.authentication,
      feedbackDirectory.workspaceIds,
      requiredPermission
    )
      ? { allowed: true }
      : { allowed: false };
  }

  try {
    const minPermission: "read" | "readWrite" = requiredPermission === "read" ? "read" : "readWrite";

    await checkAuthorizationUpdated({
      userId: principal.userId,
      organizationId: feedbackDirectory.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        ...feedbackDirectory.workspaceIds.map((workspaceId) => ({
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

export const feedbackRecordsGatewayAuthorizer: TGatewayRequestAuthorizer = {
  matches: (originalRequest) => normalizeFeedbackRecordsPath(originalRequest.url.pathname) !== null,
  gatewayToken: {
    getTokenFromHeaders: getFeedbackRecordsGatewayJwtFromHeaders,
    verifyToken: verifyFeedbackRecordsGatewayToken,
  },
  authorize: async ({ request, originalRequest, principal, requestId }) => {
    const route = parseFeedbackRecordsGatewayRoute(originalRequest.method, originalRequest.url.pathname);
    if (!route) {
      return {
        status: "deny",
        response: buildGatewayStatusResponse(400, "Unsupported FeedbackRecords route"),
      };
    }

    const tenantResolution = await resolveTenantId(request, route, originalRequest.url, requestId);
    if ("errorResponse" in tenantResolution) {
      return {
        status: "deny",
        response: tenantResolution.errorResponse,
      };
    }

    const authorizationResult = await authorizeFeedbackRecordsGatewayRequest(
      principal,
      tenantResolution.tenantId,
      route.requiredPermission
    );
    if (!authorizationResult.allowed) {
      logger.info(
        {
          requestId,
          principalType: principal.type,
          operation: route.operation,
          feedbackDirectoryId: tenantResolution.tenantId,
          verdict: "deny",
        },
        "Feedback records gateway authorization denied"
      );
      return {
        status: "deny",
        response: buildGatewayStatusResponse(403, "Forbidden"),
      };
    }

    logger.info(
      {
        requestId,
        operation: route.operation,
        principalType: principal.type,
        feedbackDirectoryId: tenantResolution.tenantId,
        verdict: "allow",
      },
      "Feedback records gateway authorization allowed"
    );

    return allowGatewayRequest();
  },
};
