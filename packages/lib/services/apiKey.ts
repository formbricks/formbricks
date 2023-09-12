import "server-only";

import { prisma } from "@formbricks/database";
import { TApiKey, TApiKeyCreateInput } from "@formbricks/types/v1/apiKeys";
import { Prisma } from "@prisma/client";
import { getHash } from "../crypto";
import { createHash, randomBytes } from "crypto";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { cache } from "react";

export const getApiKey = async (apiKey: string): Promise<TApiKey | null> => {
  if (!apiKey) {
    throw new InvalidInputError("API key cannot be null or undefined.");
  }

  try {
    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        hashedKey: getHash(apiKey),
      },
    });

    if (!apiKeyData) {
      throw new ResourceNotFoundError("API Key", apiKey);
    }

    return apiKeyData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getApiKeys = cache(async (environmentId: string): Promise<TApiKey[]> => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        environmentId,
      },
    });

    return apiKeys;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
});

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export async function createApiKey(environmentId: string, apiKeyData: TApiKeyCreateInput): Promise<TApiKey> {
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
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
}

export const getApiKeyFromKey = async (apiKey: string): Promise<TApiKey | null> => {
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
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const deleteApiKey = async (id: string): Promise<void> => {
  try {
    await prisma.apiKey.delete({
      where: {
        id: id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
