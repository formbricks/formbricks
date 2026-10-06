import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { RequestBodyTooLargeError, readRequestBodyWithLimit } from "@/app/lib/api/request-body";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getFeedbackDirectoryAuthorizationAction } from "@/lib/authorization/permission-action";
import { verifyFeedbackRecordsGatewayToken } from "@/lib/jwt";
import { getBearerTokenFromHeaders } from "@/modules/api/lib/api-key-auth";
import { getFeedbackDirectoryAuthContext } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  type TGatewayJsonBodyRejectionReason,
  hasCaseVariantKey,
  parseGatewayJsonObject,
} from "@/modules/gateway-auth/lib/json-body";
import {
  TGatewayAuthenticatedPrincipal,
  TGatewayRequestAuthorizer,
  allowGatewayRequest,
  buildGatewayStatusResponse,
} from "@/modules/gateway-auth/lib/request";
import {
  type TFeedbackRecordsGatewayPermission,
  hasApiKeyImplicitFeedbackDirectoryAccess,
} from "@/modules/hub/feedback-records-gateway-authz";
import { normalizeFeedbackRecordsPath } from "@/modules/hub/feedback-records-routing";
import { getFeedbackRecordTenant } from "@/modules/hub/service";

const ZFeedbackRecordId = z.uuid();

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

/**
 * Operations that change or destroy records that already exist. A feedback directory is shared by
 * every workspace it is assigned to and its records carry no workspace of their own, so a workspace
 * permission cannot tell one workspace's records from another's — a `readWrite` member of workspace B
 * would otherwise edit or delete records that workspace A's surveys ingested (ENG-1770). For session
 * users these are restricted to organization owners and managers. `create` is deliberately not in
 * this set: adding records to a shared directory is ordinary workspace work, like a CSV import.
 *
 * API keys are gated on this too, by a different rule: a key has no organization role to check, so it
 * authorizes on its per-workspace permissions and may therefore mutate only a directory that is not
 * shared at all (ENG-2189, see `canApiKeyMutateFeedbackDirectoryRecords`). Both rules answer the same
 * question — a workspace permission cannot identify whose records these are — and neither applies to
 * `create`.
 */
const RECORD_MUTATING_OPERATIONS = new Set<TFeedbackRecordsGatewayOperation>([
  "update",
  "delete",
  "bulkDelete",
]);

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
        // `manage`, not `write`: everywhere else in the API `methodPermissionMap` reserves DELETE for
        // `manage`, and feedback-record deletion is unrecoverable (ENG-2083).
        return { operation: "bulkDelete", requiredPermission: "manage", tenantSource: "query" };
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
        // `manage` for the same reason as `bulkDelete` above (ENG-2083).
        return {
          operation: "delete",
          requiredPermission: "manage",
          tenantSource: "recordLookup",
          recordId,
        };
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
      tenantSource: "recordLookup",
      recordId,
    };
  }

  return null;
};

type TAuthenticatedGatewayPrincipal = TGatewayAuthenticatedPrincipal;

const TENANT_ID_KEY = "tenant_id";
const INVALID_REQUEST_BODY_MESSAGE = "Invalid request body";
const AMBIGUOUS_TENANT_ID_MESSAGE = "Ambiguous tenant_id";

/**
 * A refused ambiguous request is a likely probe, so it is logged — with the reason only. The keys are
 * caller-controlled and never logged, and neither are directory or record ids.
 */
const logAmbiguousRequest = (
  requestId: string,
  route: TParsedGatewayRoute,
  reason: TGatewayJsonBodyRejectionReason | "case_variant_tenant_id" | "repeated_tenant_id"
): void => {
  logger.warn(
    { requestId, operation: route.operation, reason },
    "Feedback records gateway refused an ambiguous request"
  );
};

const parseTenantId = (tenantId: string | null): string | null => {
  if (!tenantId) {
    return null;
  }

  return ZId.safeParse(tenantId).success ? tenantId : null;
};

/**
 * Reads the body the upstream will receive verbatim. A body whose keys could be read more than one way
 * is refused rather than authorized, because the Hub would not necessarily act on the `tenant_id` this
 * authorizer checked (ENG-3658) — see `parseGatewayJsonObject`. Hubs from the ENG-3658 release on
 * refuse such bodies too; this gate is what protects deployments still running an older one.
 */
const parseJsonBody = async (
  request: NextRequest,
  route: TParsedGatewayRoute,
  requestId: string
): Promise<
  | {
      ok: true;
      body: Record<string, unknown> | null;
      keys: string[];
    }
  | {
      ok: false;
      response: Response;
    }
> => {
  let rawBody: string;
  try {
    rawBody = await readRequestBodyWithLimit(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { ok: false, response: buildGatewayStatusResponse(413, "Payload Too Large") };
    }

    return { ok: false, response: buildGatewayStatusResponse(400, INVALID_REQUEST_BODY_MESSAGE) };
  }

  if (!rawBody.trim()) {
    return { ok: true, body: null, keys: [] };
  }

  const parseResult = parseGatewayJsonObject(rawBody);
  if (!parseResult.ok) {
    if (parseResult.reason === "duplicate_key" || parseResult.reason === "non_ascii_key") {
      logAmbiguousRequest(requestId, route, parseResult.reason);
    }

    return { ok: false, response: buildGatewayStatusResponse(400, INVALID_REQUEST_BODY_MESSAGE) };
  }

  return { ok: true, body: parseResult.body, keys: parseResult.keys };
};

const getFeedbackRecordsGatewayJwtFromHeaders = (headers: Headers): string | null => {
  return getBearerTokenFromHeaders(headers);
};

const resolveTenantId = async (
  request: NextRequest,
  route: TParsedGatewayRoute,
  originalUrl: URL,
  requestId: string
): Promise<{ tenantId: string } | { errorResponse: Response }> => {
  if (route.tenantSource === "query") {
    const tenantIds = originalUrl.searchParams.getAll(TENANT_ID_KEY);
    if (tenantIds.length > 1) {
      logAmbiguousRequest(requestId, route, "repeated_tenant_id");
      return {
        errorResponse: buildGatewayStatusResponse(400, AMBIGUOUS_TENANT_ID_MESSAGE),
      };
    }

    const tenantId = parseTenantId(tenantIds[0] ?? null);
    if (!tenantId) {
      return {
        errorResponse: buildGatewayStatusResponse(400, "Invalid or missing tenant_id"),
      };
    }

    return { tenantId };
  }

  if (route.tenantSource === "body") {
    const parseResult = await parseJsonBody(request, route, requestId);
    if (!parseResult.ok) {
      return { errorResponse: parseResult.response };
    }

    // A Hub that decodes with Go's encoding/json v1 (every release before ENG-3658) matches JSON keys
    // case-insensitively, so `TENANT_ID` next to `tenant_id` would be the tenant it acts on while
    // `tenant_id` is the one authorized here.
    if (hasCaseVariantKey(parseResult.keys, TENANT_ID_KEY)) {
      logAmbiguousRequest(requestId, route, "case_variant_tenant_id");
      return {
        errorResponse: buildGatewayStatusResponse(400, AMBIGUOUS_TENANT_ID_MESSAGE),
      };
    }

    const tenantValue = parseResult.body?.[TENANT_ID_KEY];
    const tenantId = parseTenantId(typeof tenantValue === "string" ? tenantValue : null);
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
      logger.warn({ requestId }, "Feedback record tenant lookup returned not found");
      return {
        errorResponse: buildGatewayStatusResponse(403, "Forbidden"),
      };
    }

    logger.warn({ requestId, hubStatus: tenantLookup.error.status }, "Feedback record tenant lookup failed");
    return {
      errorResponse: buildGatewayStatusResponse(503, "Feedback record lookup failed"),
    };
  }

  const tenantId = parseTenantId(tenantLookup.data?.tenantId ?? null);
  if (!tenantId) {
    logger.warn({ requestId }, "Feedback record tenant lookup returned invalid tenant");
    return {
      errorResponse: buildGatewayStatusResponse(503, "Feedback record lookup failed"),
    };
  }

  return { tenantId };
};

const authorizeFeedbackRecordsGatewayRequest = async (
  principal: TAuthenticatedGatewayPrincipal,
  feedbackDirectoryId: string,
  requiredPermission: TFeedbackRecordsGatewayPermission,
  operation: TFeedbackRecordsGatewayOperation
): Promise<{ allowed: true } | { allowed: false }> => {
  const isRecordMutation = RECORD_MUTATING_OPERATIONS.has(operation);
  const feedbackDirectory = await getFeedbackDirectoryAuthContext(feedbackDirectoryId);
  if (!feedbackDirectory || feedbackDirectory.isArchived) {
    return { allowed: false };
  }

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(
    feedbackDirectory.organizationId
  );
  if (!isFeedbackDirectoriesAllowed) {
    return { allowed: false };
  }

  if (principal.type === "apiKey") {
    const legacySafeguardsAllow = hasApiKeyImplicitFeedbackDirectoryAccess(
      principal.authentication,
      feedbackDirectory.organizationId,
      feedbackDirectory.workspaceIds,
      requiredPermission,
      isRecordMutation
    );
    if (!legacySafeguardsAllow) return { allowed: false };

    const allowed = await can(
      { type: "apiKey", id: principal.authentication.apiKeyId },
      getFeedbackDirectoryAuthorizationAction(requiredPermission),
      { type: "feedbackDirectory", id: feedbackDirectoryId }
    );
    return { allowed };
  }

  const allowed = isRecordMutation
    ? await can({ type: "user", id: principal.userId }, "organization.manage", {
        type: "organization",
        id: feedbackDirectory.organizationId,
      })
    : await can(
        { type: "user", id: principal.userId },
        getFeedbackDirectoryAuthorizationAction(requiredPermission),
        { type: "feedbackDirectory", id: feedbackDirectoryId }
      );

  return { allowed };
};

export const feedbackRecordsGatewayAuthorizer: TGatewayRequestAuthorizer = {
  matches: (originalRequest) => normalizeFeedbackRecordsPath(originalRequest.url.pathname) !== null,
  gatewayToken: {
    getTokenFromHeaders: getFeedbackRecordsGatewayJwtFromHeaders,
    verifyToken: verifyFeedbackRecordsGatewayToken,
  },
  authorize: async ({ request, originalRequest, principal, requestId }) =>
    withAuthorizationSurface("feedback_gateway", async () => {
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
        route.requiredPermission,
        route.operation
      );
      if (!authorizationResult.allowed) {
        logger.info(
          {
            requestId,
            principalType: principal.type,
            operation: route.operation,
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
          verdict: "allow",
        },
        "Feedback records gateway authorization allowed"
      );

      return allowGatewayRequest();
    }),
};
