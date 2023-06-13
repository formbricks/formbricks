import { prisma } from "@formbricks/database";
import { getHash } from "../crypto";
import { TApiKey } from "@formbricks/types/v1/apiKeys";

export const getApiKey = async (apiKey: string): Promise<TApiKey | null> => {
  return await prisma.apiKey.findUnique({
    where: {
      hashedKey: getHash(apiKey),
    },
  });
};

export const getApiKeyFromKey = async (apiKey: string): Promise<TApiKey | null> => {
  return await prisma.apiKey.findUnique({
    where: {
      hashedKey: getHash(apiKey),
    },
  });
};
