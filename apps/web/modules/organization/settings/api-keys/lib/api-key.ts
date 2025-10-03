import "server-only";
import { ApiKey, ApiKeyPermission, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { hashSecret, hashSha256, parseApiKeyV2, verifySecret } from "@/lib/crypto";
import { validateInputs } from "@/lib/utils/validate";
import {
  TApiKeyCreateInput,
  TApiKeyUpdateInput,
  TApiKeyWithEnvironmentAndProject,
  TApiKeyWithEnvironmentPermission,
  ZApiKeyCreateInput,
} from "@/modules/organization/settings/api-keys/types/api-keys";

export const getApiKeysWithEnvironmentPermissions = reactCache(
  async (organizationId: string): Promise<TApiKeyWithEnvironmentPermission[]> => {
    validateInputs([organizationId, ZId]);

    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          label: true,
          createdAt: true,
          organizationAccess: true,
          apiKeyEnvironments: {
            select: {
              environmentId: true,
              permission: true,
            },
          },
        },
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
  async (apiKey: string): Promise<TApiKeyWithEnvironmentAndProject | null> => {
    try {
      const includeQuery = {
        apiKeyEnvironments: {
          include: {
            environment: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      };

      // Try v2 format first (fbk_{id}_{secret})
      const v2Parsed = parseApiKeyV2(apiKey);

      let apiKeyData;

      if (v2Parsed) {
        // New v2 format: lookup by id and verify with bcrypt
        apiKeyData = await prisma.apiKey.findUnique({
          where: { id: v2Parsed.id },
          include: includeQuery,
        });

        if (!apiKeyData) return null;

        // Verify the secret against the bcrypt hash
        const isValid = await verifySecret(v2Parsed.secret, apiKeyData.hashedKey);
        if (!isValid) return null;
      } else {
        // Legacy format: compute SHA-256 and lookup by hashedKey
        const hashedKey = hashSha256(apiKey);
        apiKeyData = await prisma.apiKey.findUnique({
          where: { hashedKey },
          include: includeQuery,
        });

        if (!apiKeyData) return null;
      }

      // Update the last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKeyData.id },
        data: { lastUsedAt: new Date() },
      });

      return apiKeyData;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const deleteApiKey = async (id: string): Promise<ApiKey | null> => {
  validateInputs([id, ZId]);

  try {
    const deletedApiKeyData = await prisma.apiKey.delete({
      where: {
        id: id,
      },
    });

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
    environmentPermissions?: Array<{ environmentId: string; permission: ApiKeyPermission }>;
    organizationAccess: TOrganizationAccess;
  }
): Promise<TApiKeyWithEnvironmentPermission & { actualKey: string }> => {
  validateInputs([organizationId, ZId], [apiKeyData, ZApiKeyCreateInput]);
  try {
    // Generate a secure random secret (24 bytes base64url)
    const secret = randomBytes(24).toString("base64url");
    const hashedKey = await hashSecret(secret, 12);

    // Extract environmentPermissions from apiKeyData
    const { environmentPermissions, organizationAccess, ...apiKeyDataWithoutPermissions } = apiKeyData;

    // Create the API key
    const result = await prisma.apiKey.create({
      data: {
        ...apiKeyDataWithoutPermissions,
        hashedKey,
        createdBy: userId,
        organization: { connect: { id: organizationId } },
        organizationAccess,
        ...(environmentPermissions && environmentPermissions.length > 0
          ? {
              apiKeyEnvironments: {
                create: environmentPermissions.map((envPerm) => ({
                  environmentId: envPerm.environmentId,
                  permission: envPerm.permission,
                })),
              },
            }
          : {}),
      },
      include: {
        apiKeyEnvironments: true,
      },
    });

    // Return the new v2 format: fbk_{id}_{secret}
    return { ...result, actualKey: `fbk_${result.id}_${secret}` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateApiKey = async (apiKeyId: string, data: TApiKeyUpdateInput): Promise<ApiKey | null> => {
  try {
    const updatedApiKey = await prisma.apiKey.update({
      where: {
        id: apiKeyId,
      },
      data: {
        label: data.label,
      },
    });

    return updatedApiKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
