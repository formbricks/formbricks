import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  noContentResponse,
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromApiKeyId } from "@/lib/utils/helper";
import {
  createApiKey,
  deleteApiKey,
  getApiKeysWithEnvironmentPermissions,
  updateApiKey,
} from "@/modules/organization/settings/api-keys/lib/api-key";
import { assertCanGrantOrganizationAccess } from "@/modules/organization/settings/api-keys/lib/organization-access";
import type { TApiKeyCreateBody, TApiKeyUpdateBody } from "../schemas";
import { type TApiKeyResource, type TCreatedApiKeyResource, serializeApiKey } from "../serializers";

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

export const API_KEYS_BASE_PATH = "/api/internal/api-keys";

/** The organization's keys, for the API keys settings page. Owners and managers only, as on the page. */
export async function listApiKeysForOrganization(organizationId: string): Promise<TApiKeyResource[]> {
  return (await getApiKeysWithEnvironmentPermissions(organizationId)).map(serializeApiKey);
}

export async function listApiKeysOperation({
  authentication,
  organizationId,
  requestId,
  instance,
}: TRequestContext & { organizationId: string }): Promise<Response> {
  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage_api_keys",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  return successResponse(await listApiKeysForOrganization(access.organizationId), { requestId });
}

/**
 * Mint a key. The plaintext key is in this response and nowhere else, ever. Granting a key organization
 * *write* access (user management) needs the organization's user-management role on top of managing API
 * keys (ENG-3075), and every workspace it names must belong to the organization (ENG-1749).
 */
export async function createApiKeyOperation({
  authentication,
  organizationId,
  body,
  requestId,
  instance,
  auditLog,
}: TRequestContext & { organizationId: string; body: TApiKeyCreateBody }): Promise<Response> {
  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage_api_keys",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  try {
    await assertCanGrantOrganizationAccess(access.userId, access.organizationId, body.organizationAccess);
  } catch (error) {
    if (error instanceof OperationNotAllowedError) {
      return problemForbidden(
        requestId,
        "Your role can't grant user management access to an API key.",
        instance
      );
    }
    throw error;
  }

  let created;
  try {
    created = await createApiKey(access.organizationId, access.userId, body);
  } catch (error) {
    // The only refusal `createApiKey` raises: a workspace that isn't the organization's.
    if (error instanceof OperationNotAllowedError) {
      return problemUnprocessableContent(
        requestId,
        "The API key names a workspace outside this organization.",
        {
          instance,
          invalid_params: [
            { name: "workspacePermissions", reason: "Every workspace must belong to the organization." },
          ],
        }
      );
    }
    throw error;
  }

  if (auditLog) {
    auditLog.targetId = created.id;
    auditLog.newObject = body;
  }
  capturePostHogEvent(
    access.userId,
    "api_key_created",
    { api_key_id: created.id },
    { organizationId: access.organizationId }
  );

  const resource: TCreatedApiKeyResource = { ...serializeApiKey(created), apiKey: created.actualKey };
  return createdResponse(resource, { location: `${API_KEYS_BASE_PATH}/${created.id}`, requestId });
}

/**
 * Authorize a change to one key and resolve its organization for the audit log. A key the caller can't
 * manage and a key that doesn't exist both get the same 403, so ids can't be probed.
 */
async function authorizeApiKeyChange(
  apiKeyId: string,
  { authentication, requestId, instance }: TRequestContext
): Promise<Response | { organizationId: string }> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  if (!(await can(actor, "apiKey.manage", { type: "apiKey", id: apiKeyId }))) {
    return problemForbidden(requestId, undefined, instance);
  }

  try {
    return { organizationId: await getOrganizationIdFromApiKeyId(apiKeyId) };
  } catch (error) {
    // Deleted between the check and the lookup.
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }
}

export async function updateApiKeyOperation({
  apiKeyId,
  body,
  ...context
}: TRequestContext & { apiKeyId: string; body: TApiKeyUpdateBody }): Promise<Response> {
  const { auditLog, requestId } = context;
  if (auditLog) auditLog.newObject = body;

  const authorized = await authorizeApiKeyChange(apiKeyId, context);
  if (authorized instanceof Response) return authorized;
  if (auditLog) {
    auditLog.organizationId = authorized.organizationId;
    auditLog.targetId = apiKeyId;
  }

  const updated = await updateApiKey(apiKeyId, body);
  return successResponse(serializeApiKey(updated), { requestId });
}

export async function deleteApiKeyOperation({
  apiKeyId,
  ...context
}: TRequestContext & { apiKeyId: string }): Promise<Response> {
  const { auditLog, requestId } = context;

  const authorized = await authorizeApiKeyChange(apiKeyId, context);
  if (authorized instanceof Response) return authorized;
  if (auditLog) {
    auditLog.organizationId = authorized.organizationId;
    auditLog.targetId = apiKeyId;
  }

  const deleted = await deleteApiKey(apiKeyId);
  // What was removed, minus the stored hashes, which the action used to write into the audit log.
  if (auditLog && deleted) {
    auditLog.oldObject = {
      id: deleted.id,
      label: deleted.label,
      createdAt: deleted.createdAt,
      organizationAccess: deleted.organizationAccess,
    };
  }
  return noContentResponse({ requestId });
}
