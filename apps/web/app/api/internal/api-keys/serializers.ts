import type { ApiKeyPermission } from "@formbricks/database/prisma";
import type { TOrganizationAccess } from "@formbricks/types/api-key";

/**
 * An API key as the settings page shows it. Never the secret or its hashes: the plaintext key exists only
 * in the create response, once (`TCreatedApiKeyResource`), and the stored hashes never leave the server.
 */
export type TApiKeyResource = {
  id: string;
  label: string;
  createdAt: string;
  organizationAccess: TOrganizationAccess;
  apiKeyWorkspaces: { workspaceId: string; permission: ApiKeyPermission }[];
};

export type TCreatedApiKeyResource = TApiKeyResource & {
  /** The plaintext key. Returned by the create call only; it can't be read back afterwards. */
  apiKey: string;
};

type TApiKeyRow = {
  id: string;
  label: string;
  createdAt: Date;
  organizationAccess: unknown;
  apiKeyWorkspaces: { workspaceId: string; permission: ApiKeyPermission }[];
};

export const serializeApiKey = (apiKey: TApiKeyRow): TApiKeyResource => ({
  id: apiKey.id,
  label: apiKey.label,
  createdAt: apiKey.createdAt.toISOString(),
  organizationAccess: apiKey.organizationAccess as TOrganizationAccess,
  apiKeyWorkspaces: apiKey.apiKeyWorkspaces.map(({ workspaceId, permission }) => ({
    workspaceId,
    permission,
  })),
});
