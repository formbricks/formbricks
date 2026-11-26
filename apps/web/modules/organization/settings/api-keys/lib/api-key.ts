import "server-only";
import { randomBytes } from "node:crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ApiKeyPermission, Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";
import { reconcileApiKeyRelationships } from "@/lib/authzed/api-key";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { hashSecret, hashSha256, isApiKeyLookupHashMatch, parseApiKeyV2 } from "@/lib/crypto";
import { validateInputs } from "@/lib/utils/validate";
import { getWorkspacesByOrganizationId } from "@/modules/organization/settings/api-keys/lib/workspaces";
import {
  TApiKeyCreateInput,
  TApiKeyUpdateInput,
  TApiKeyWithEnvironmentAndWorkspace,
  TApiKeyWithEnvironmentPermission,
  ZApiKeyCreateInput,
} from "@/modules/organization/settings/api-keys/types/api-keys";

/**
 * The only shape of an API key that may leave the server (server-action results, page props, audit
 * objects). `hashedKey` and `lookupHash` are deliberately absent: neither has a reason to reach a
 * browser or the audit log (ENG-7312). Every read that returns a key to a caller uses this select.
 */
const apiKeyClientSelect = {
  id: true,
  label: true,
  createdAt: true,
  organizationAccess: true,
  apiKeyWorkspaces: {
    select: {
      permission: true,
      workspaceId: true,
    },
  },
} satisfies Prisma.ApiKeySelect;

export const getApiKeysWithEnvironmentPermissions = reactCache(
  async (organizationId: string): Promise<TApiKeyWithEnvironmentPermission[]> => {
    validateInputs([organizationId, ZId]);

    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          organizationId,
        },
        select: apiKeyClientSelect,
        // Oldest first, so a rename or a new key doesn't reshuffle the list the page refetches.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return apiKeys;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

// Get API key with its permissions from a raw API key
export const getApiKeyWithPermissions = reactCache(
  async (apiKey: string): Promise<TApiKeyWithEnvironmentAndWorkspace | null> => {
    try {
      const includeQuery = {
        apiKeyWorkspaces: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                // ENG-1749: needed so the auth layer can drop any workspace permission whose
                // workspace is outside the key's organization (defense-in-depth for the read path,
                // which authorizes off the permission list rather than resolveBodyIdsV2).
                organizationId: true,
              },
            },
          },
        },
      };

      // Try v2 format first (fbk_{secret})
      const v2Parsed = parseApiKeyV2(apiKey);

      let apiKeyData;

      if (v2Parsed) {
        // New v2 format (fbk_{secret}): Hybrid approach
        // Step 1: Fast SHA-256 lookup by indexed lookupHash
        const lookupHash = hashSha256(v2Parsed.secret);
        apiKeyData = await prisma.apiKey.findUnique({
          where: { lookupHash },
          include: includeQuery,
        });

        // Step 2: the secret is 32 random bytes, so a row found by SHA-256(secret) already proves
        // possession; bcrypt would add ~300ms of main-thread CPU per request for no extra security
        // (and let anonymous callers burn it with random keys). Unknown key and wrong secret are
        // the same "no row" outcome, so there is nothing to distinguish. The comparison below is
        // defense-in-depth and constant-time.
        if (!apiKeyData || !isApiKeyLookupHashMatch(apiKeyData.lookupHash, lookupHash)) {
          return null;
        }
      } else {
        // Legacy format: compute SHA-256 and lookup by hashedKey
        const hashedKey = hashSha256(apiKey);
        apiKeyData = await prisma.apiKey.findFirst({
          where: { hashedKey: hashedKey },
          include: includeQuery,
        });

        if (!apiKeyData) return null;
      }

      if (!apiKeyData.lastUsedAt || apiKeyData.lastUsedAt <= new Date(Date.now() - 1000 * 30)) {
        // Fire-and-forget: update lastUsedAt in the background without blocking the response
        // Update on first use (null) or if last used more than 30 seconds ago
        prisma.apiKey
          .update({
            where: { id: apiKeyData.id },
            data: { lastUsedAt: new Date() },
          })
          .catch((error) => {
            logger.error({ error }, "Failed to update API key usage");
          });
      }

      return apiKeyData as TApiKeyWithEnvironmentAndWorkspace;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const deleteApiKey = async (id: string): Promise<TApiKeyWithEnvironmentPermission | null> => {
  validateInputs([id, ZId]);

  try {
    const deletedApiKeyData = await prisma.apiKey.delete({
      where: {
        id: id,
      },
      select: apiKeyClientSelect,
    });

    await runPostCommitProjection("api_key_delete_relationship_reconciliation", () =>
      reconcileApiKeyRelationships({ apiKeyIds: [id] })
    );

    return deletedApiKeyData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const createApiKey = async (
  organizationId: string,
  userId: string,
  apiKeyData: TApiKeyCreateInput & {
    workspacePermissions?: Array<{
      workspaceId: string;
      permission: ApiKeyPermission;
    }>;
    organizationAccess: TOrganizationAccess;
  }
): Promise<TApiKeyWithEnvironmentPermission & { actualKey: string }> => {
  validateInputs([organizationId, ZId], [apiKeyData, ZApiKeyCreateInput]);
  try {
    // ENG-1749: an API key is created at the organization level but carries per-workspace
    // permissions. Reject any workspace that does not belong to the authorized organization,
    // otherwise a caller could mint a key scoped to another tenant's workspace (cross-tenant
    // BOLA). Validate before generating/hashing the secret so illegitimate input does no work.
    const { workspacePermissions, organizationAccess, ...apiKeyDataWithoutPermissions } = apiKeyData;
    if (workspacePermissions && workspacePermissions.length > 0) {
      const orgWorkspaceIds = new Set(
        (await getWorkspacesByOrganizationId(organizationId)).map((workspace) => workspace.id)
      );
      for (const { workspaceId } of workspacePermissions) {
        if (!orgWorkspaceIds.has(workspaceId)) {
          throw new OperationNotAllowedError(
            `Workspace ${workspaceId} does not belong to organization ${organizationId}`
          );
        }
      }
    }

    // Generate a secure random secret (32 bytes base64url)
    const secret = randomBytes(32).toString("base64url");

    // Hybrid approach for security + performance:
    // 1. SHA-256 lookup hash
    const lookupHash = hashSha256(secret);

    // 2. bcrypt hash
    const hashedKey = await hashSecret(secret, 12);

    // Create the API key
    const result = await prisma.apiKey.create({
      data: {
        ...apiKeyDataWithoutPermissions,
        hashedKey,
        lookupHash,
        createdBy: userId,
        organization: { connect: { id: organizationId } },
        organizationAccess,
        ...(workspacePermissions && workspacePermissions.length > 0
          ? {
              apiKeyWorkspaces: {
                create: workspacePermissions.map((wsPerm) => ({
                  permission: wsPerm.permission,
                  workspaceId: wsPerm.workspaceId,
                })),
              },
            }
          : {}),
      },
      select: apiKeyClientSelect,
    });

    await runPostCommitProjection("api_key_create_relationship_reconciliation", () =>
      reconcileApiKeyRelationships({ apiKeyIds: [result.id] })
    );

    // Return the new v2 format: fbk_{secret}
    return { ...result, actualKey: `fbk_${secret}` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Rename a key. Returns the fields the settings page shows — never the stored hashes, which have no
 * business leaving this module (they used to reach the caller and, through it, the audit log).
 */
export const updateApiKey = async (
  apiKeyId: string,
  data: TApiKeyUpdateInput
): Promise<TApiKeyWithEnvironmentPermission> => {
  try {
    const updatedApiKey = await prisma.apiKey.update({
      where: {
        id: apiKeyId,
      },
      data: {
        label: data.label,
      },
      select: apiKeyClientSelect,
    });

    return updatedApiKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
