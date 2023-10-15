import { prisma } from "@formbricks/database";
import { TNotionConfig, TNotionDatabase, TNotionIntegration } from "@formbricks/types/v1/integrations";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { symmetricDecrypt } from "../crypto";
import { ENCRYPTION_KEY } from "../constants";

async function fetchPages(config: TNotionIntegration["config"]) {
  try {
    const res = await fetch("https://api.notion.com/v1/search", {
      headers: getHeaders(config),
      method: "POST",
      body: JSON.stringify({
        page_size: 100,
        filter: {
          value: "database",
          property: "object",
        },
      }),
    });
    return (await res.json()).results;
  } catch (err) {
    throw err;
  }
}

export const getNotionDatabases = async (environmentId: string): Promise<TNotionDatabase[]> => {
  let results: TNotionDatabase[] = [];
  try {
    const notionIntegration = await getNotionIntegration(environmentId);
    if (notionIntegration && notionIntegration.config?.key.bot_id) {
      results = await fetchPages(notionIntegration.config);
    }
    return results;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};

export const getNotionIntegration = cache(
  async (environmentId: string): Promise<TNotionIntegration | null> => {
    try {
      const result = await prisma.integration.findUnique({
        where: {
          type_environmentId: {
            environmentId,
            type: "notion",
          },
        },
      });
      // Type Guard
      if (result && isNotionIntegration(result)) {
        return result as TNotionIntegration; // Explicit casting
      }
      return null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError("Database operation failed");
      }
      throw error;
    }
  }
);

export async function writeData(
  databaseId: string,
  properties: Record<string, Object>,
  config: TNotionConfig
) {
  try {
    await fetch(`https://api.notion.com/v1/pages`, {
      headers: getHeaders(config),
      method: "POST",
      body: JSON.stringify({
        parent: {
          database_id: databaseId,
        },
        properties: properties,
      }),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
}

function isNotionIntegration(integration: any): integration is TNotionIntegration {
  return integration.type === "notion";
}

function getHeaders(config: TNotionConfig) {
  const decryptedToken = symmetricDecrypt(config.key.access_token, ENCRYPTION_KEY);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${decryptedToken}`,
    "Notion-Version": "2022-06-28",
  };
}
