import "server-only";
import { apiKeyCache } from "@/lib/cache/api-key";
import {
  TApiKeyCreateInput,
  TApiKeyWithEnvironmentPermission,
  ZApiKeyCreateInput,
} from "@/modules/organization/settings/api-keys/types/api-keys";
import { ApiKey, ApiKeyPermission, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getApiKeysWithEnvironmentPermissions = reactCache(
  async (organizationId: string): Promise<TApiKeyWithEnvironmentPermission[]> =>
    cache(
      async () => {
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
      },
      [`getApiKeysWithEnvironments-${organizationId}`],
      {
        tags: [apiKeyCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

// Get API key with its permissions from a raw API key
export const getApiKeyWithPermissions = reactCache(async (apiKey: string) => {
  const hashedKey = hashApiKey(apiKey);
  return cache(
    async () => {
      try {
        // Look up the API key in the new structure
        const apiKeyData = await prisma.apiKey.findUnique({
          where: {
            hashedKey,
          },
          include: {
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
          },
        });

        if (!apiKeyData) return null;

        // Update the last used timestamp
        await prisma.apiKey.update({
          where: {
            id: apiKeyData.id,
          },
          data: {
            lastUsedAt: new Date(),
          },
        });

        return apiKeyData;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getApiKeyWithPermissions-${apiKey}`],
    {
      tags: [apiKeyCache.tag.byHashedKey(hashedKey)],
    }
  )();
});

export const deleteApiKey = async (id: string): Promise<ApiKey | null> => {
  validateInputs([id, ZId]);

  try {
    const deletedApiKeyData = await prisma.apiKey.delete({
      where: {
        id: id,
      },
    });

    apiKeyCache.revalidate({
      id: deletedApiKeyData.id,
      hashedKey: deletedApiKeyData.hashedKey,
      organizationId: deletedApiKeyData.organizationId,
    });

    return deletedApiKeyData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

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
    const key = randomBytes(16).toString("hex");
    const hashedKey = hashApiKey(key);

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

    apiKeyCache.revalidate({
      id: result.id,
      hashedKey: result.hashedKey,
      organizationId: result.organizationId,
    });

    return { ...result, actualKey: key };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
