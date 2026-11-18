import { TIntegrationNotionConfig, TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
import { getIntegrationByType } from "../integration/service";

const fetchPages = async (config: TIntegrationNotionConfig) => {
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
};

export const getNotionDatabases = async (workspaceId: string): Promise<TIntegrationNotionDatabase[]> => {
  let results: TIntegrationNotionDatabase[] = [];
  const notionIntegration = await getIntegrationByType(workspaceId, "notion");
  if (notionIntegration && notionIntegration.config?.key.bot_id) {
    results = await fetchPages(notionIntegration.config);
  }
  return results;
};

export const writeData = async (
  databaseId: string,
  properties: Record<string, unknown>,
  config: TIntegrationNotionConfig
) => {
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
};

const getHeaders = (config: TIntegrationNotionConfig) => {
  const decryptedToken = symmetricDecrypt(config.key.access_token, ENCRYPTION_KEY);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${decryptedToken}`,
    "Notion-Version": "2022-06-28",
  };
};
