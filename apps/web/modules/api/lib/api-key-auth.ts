import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";

type THeadersLike = Pick<Headers, "get">;

const BEARER_PREFIX = "bearer ";

const getBearerToken = (headers: THeadersLike): string | null => {
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

const isJwtLikeToken = (token: string): boolean => {
  const segments = token.split(".");
  return segments.length === 3 && segments.every((segment) => segment.length > 0);
};

export const getApiKeyFromHeaders = (headers: THeadersLike): string | null => {
  const apiKeyHeader = headers.get("x-api-key")?.trim();
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  const bearerToken = getBearerToken(headers);
  if (!bearerToken || isJwtLikeToken(bearerToken)) {
    return null;
  }

  return bearerToken;
};

export const getFeedbackRecordsGatewayJwtFromHeaders = (headers: THeadersLike): string | null => {
  const bearerToken = getBearerToken(headers);
  if (!bearerToken || !isJwtLikeToken(bearerToken)) {
    return null;
  }

  return bearerToken;
};

export const authenticateApiKeyFromHeaders = async (
  headers: THeadersLike
): Promise<TAuthenticationApiKey | null> => {
  const apiKey = getApiKeyFromHeaders(headers);
  if (!apiKey) {
    return null;
  }

  const apiKeyData = await getApiKeyWithPermissions(apiKey);
  if (!apiKeyData) {
    return null;
  }

  return {
    type: "apiKey",
    workspacePermissions: (apiKeyData.apiKeyWorkspaces ?? []).map((workspacePermission) => ({
      permission: workspacePermission.permission,
      workspaceId: workspacePermission.workspaceId,
      workspaceName: workspacePermission.workspace.name,
    })),
    feedbackRecordDirectoryPermissions: (apiKeyData.apiKeyFeedbackRecordDirectories ?? []).map(
      (directoryPermission) => ({
        permission: directoryPermission.permission,
        feedbackRecordDirectoryId: directoryPermission.feedbackRecordDirectoryId,
        feedbackRecordDirectoryName: directoryPermission.feedbackRecordDirectory.name,
      })
    ),
    apiKeyId: apiKeyData.id,
    organizationId: apiKeyData.organizationId,
    organizationAccess: apiKeyData.organizationAccess,
  };
};
