import { prisma } from "@formbricks/database";
import { TApiKey } from "@formbricks/types/v1/apiKeys";
import { Prisma } from "@prisma/client";
import { getHash } from "../crypto";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/errors";

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
