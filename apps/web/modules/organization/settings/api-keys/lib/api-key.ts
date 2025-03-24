import "server-only";
import { apiKeyNewCache } from "@/lib/cache/api-keys-new";
import {
  TApiKeyCreateInput,
  ZApiKeyCreateInput,
} from "@/modules/organization/settings/api-keys/types/api-keys";
import { ApiKey, ApiKeyPermission, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getApiKeys = reactCache(
  async (organizationId: string): Promise<ApiKey[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);

        try {
          const apiKeys = await prisma.apiKey.findMany({
            where: {
              organizationId,
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
      [`getApiKeys-${organizationId}`],
      {
        tags: [apiKeyNewCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const deleteApiKey = async (id: string): Promise<ApiKey | null> => {
  validateInputs([id, ZId]);

  try {
    const deletedApiKeyData = await prisma.apiKey.delete({
      where: {
        id: id,
      },
    });

    apiKeyNewCache.revalidate({
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
  }
): Promise<ApiKey & { actualKey: string }> => {
  validateInputs([organizationId, ZId], [apiKeyData, ZApiKeyCreateInput]);
  try {
    const key = randomBytes(16).toString("hex");
    const hashedKey = hashApiKey(key);

    // Extract environmentPermissions from apiKeyData
    const { environmentPermissions, ...apiKeyDataWithoutPermissions } = apiKeyData;

    // Create the API key
    const result = await prisma.apiKey.create({
      data: {
        ...apiKeyDataWithoutPermissions,
        hashedKey,
        createdBy: userId,
        organization: { connect: { id: organizationId } },
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

    apiKeyNewCache.revalidate({
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
