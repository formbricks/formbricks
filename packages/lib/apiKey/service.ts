import "server-only";

import { prisma } from "@formbricks/database";
import { TApiKey, TApiKeyCreateInput, ZApiKeyCreateInput } from "@formbricks/types/v1/apiKeys";
import { Prisma } from "@prisma/client";
import { getHash } from "../crypto";
import { createHash, randomBytes } from "crypto";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";
import { ZString, ZOptionalNumber } from "@formbricks/types/v1/common";
import { ITEMS_PER_PAGE } from "../constants";

export const getApiKey = async (apiKeyId: string): Promise<TApiKey | null> => {
  validateInputs([apiKeyId, ZString]);
  if (!apiKeyId) {
    throw new InvalidInputError("API key cannot be null or undefined.");
  }

  try {
    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        id: apiKeyId,
      },
    });

    if (!apiKeyData) {
      throw new ResourceNotFoundError("API Key from ID", apiKeyId);
    }

    return apiKeyData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getApiKeys = async (environmentId: string, page?: number): Promise<TApiKey[]> => {
  validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        environmentId,
      },
      take: page ? ITEMS_PER_PAGE : undefined,
      skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
    });

    return apiKeys;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export async function createApiKey(environmentId: string, apiKeyData: TApiKeyCreateInput): Promise<TApiKey> {
  validateInputs([environmentId, ZId], [apiKeyData, ZApiKeyCreateInput]);
  try {
    const key = randomBytes(16).toString("hex");
    const hashedKey = hashApiKey(key);

    const result = await prisma.apiKey.create({
      data: {
        ...apiKeyData,
        hashedKey,
        environment: { connect: { id: environmentId } },
      },
    });

    return { ...result, apiKey: key };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
}

export const getApiKeyFromKey = async (apiKey: string): Promise<TApiKey | null> => {
  validateInputs([apiKey, ZString]);
  if (!apiKey) {
    throw new InvalidInputError("API key cannot be null or undefined.");
  }

  try {
    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        hashedKey: getHash(apiKey),
      },
    });

    return apiKeyData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteApiKey = async (id: string): Promise<TApiKey | null> => {
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
