import "server-only";
import { ApiKey, ApiKeyPermission, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { CONTROL_HASH } from "@/lib/constants";
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

        // Step 2: Security verification with bcrypt
        // Always perform bcrypt verification to prevent timing attacks
        // Use a control hash when API key doesn't exist to maintain constant timing
        const hashToVerify = apiKeyData?.hashedKey || CONTROL_HASH;
        const isValid = await verifySecret(v2Parsed.secret, hashToVerify);

        if (!apiKeyData || !isValid) {
          if (apiKeyData && !isValid) {
            logger.warn({ apiKeyId: apiKeyData.id }, "API key bcrypt verification failed");
          }
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
    // Generate a secure random secret (32 bytes base64url)
    const secret = randomBytes(32).toString("base64url");

    // Hybrid approach for security + performance:
    // 1. SHA-256 lookup hash
    const lookupHash = hashSha256(secret);

    // 2. bcrypt hash
    const hashedKey = await hashSecret(secret, 12);

    // Extract environmentPermissions from apiKeyData
    const { environmentPermissions, organizationAccess, ...apiKeyDataWithoutPermissions } = apiKeyData;

    // Create the API key
    const result = await prisma.apiKey.create({
      data: {
        ...apiKeyDataWithoutPermissions,
        hashedKey,
        lookupHash,
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

    // Return the new v2 format: fbk_{secret}
    return { ...result, actualKey: `fbk_${secret}` };
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
