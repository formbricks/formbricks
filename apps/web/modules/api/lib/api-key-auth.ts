import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { parseApiKeyV2 } from "@/lib/crypto";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";

type THeadersLike = Pick<Headers, "get">;

const BEARER_PREFIX = "bearer ";

export const getBearerTokenFromHeaders = (headers: THeadersLike): string | null => {
  const authorizationHeader = headers.get("authorization")?.trim();
  if (!authorizationHeader) {
    return null;
  }

  const lowerCasedAuthorizationHeader = authorizationHeader.toLowerCase();
  if (!lowerCasedAuthorizationHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};
export const getApiKeyFromHeaders = (headers: THeadersLike): string | null => {
  const apiKeyHeader = headers.get("x-api-key")?.trim();
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  const bearerToken = getBearerTokenFromHeaders(headers);
  if (!bearerToken || !parseApiKeyV2(bearerToken)) {
    return null;
  }

  return bearerToken;
};

export type AuthenticateApiKeyOptions = {
  allowOrganizationOnlyApiKey?: boolean;
};

export const authenticateApiKeyFromHeaders = async (
  headers: THeadersLike,
  options: AuthenticateApiKeyOptions = {}
): Promise<TAuthenticationApiKey | null> => {
  const apiKey = getApiKeyFromHeaders(headers);
  if (!apiKey) {
    return null;
  }

  const apiKeyData = await getApiKeyWithPermissions(apiKey);
  if (!apiKeyData) {
    return null;
  }

  // ENG-1749 defense-in-depth: only honor workspace permissions whose workspace belongs to the
  // key's own organization. API keys are org-scoped, so a permission on a foreign workspace is
  // always illegitimate (it can only exist from a pre-fix bug/exploit). Filtering here — the single
  // point where the permission list is built — protects every consumer, including the read/list
  // routes that authorize off this list directly rather than through resolveBodyIdsV2.
  const workspacePermissions = (apiKeyData.apiKeyWorkspaces ?? [])
    .filter(
      (workspacePermission) => workspacePermission.workspace.organizationId === apiKeyData.organizationId
    )
    .map((workspacePermission) => ({
      permission: workspacePermission.permission,
      workspaceId: workspacePermission.workspaceId,
      workspaceName: workspacePermission.workspace.name,
    }));

  // Reject org-only API keys for routes that require workspace-scoped permissions
  // (those routes opt in via allowOrganizationOnlyApiKey when an org-only key is acceptable).
  // Uses the filtered list so a key left with only cross-org (now-dropped) permissions is treated
  // as having no workspace access.
  if (!options.allowOrganizationOnlyApiKey && workspacePermissions.length === 0) {
    return null;
  }

  return {
    type: "apiKey",
    workspacePermissions,
    apiKeyId: apiKeyData.id,
    organizationId: apiKeyData.organizationId,
    organizationAccess: apiKeyData.organizationAccess,
  };
};
