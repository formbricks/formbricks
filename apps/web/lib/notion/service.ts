import {
  TIntegrationNotion,
  TIntegrationNotionConfig,
  TIntegrationNotionDatabase,
} from "@formbricks/types/integration/notion";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
import { getIntegrationByType } from "../integration/service";

class NotionApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;

  constructor(message: string, opts: { status: number; code?: string; requestId?: string }) {
    super(message);
    this.name = "NotionApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId;
  }
}

const NOTION_MAX_ATTEMPTS = 3;
const NOTION_BACKOFF_MS = 250;

const isRetryableNotionStatus = (status: number): boolean => {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
};

const getNotionRequestId = (headers: Headers): string | undefined => {
  return headers.get("x-request-id") ?? headers.get("x-notion-request-id") ?? undefined;
};

const getRetryDelayMs = (attempt: number, headers?: Headers): number => {
  if (headers) {
    const retryAfter = headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number.parseInt(retryAfter, 10);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, 2000);
      }
    }
  }

  // attempt 1: 0ms, attempt 2: 250ms, attempt 3: 500ms
  return (attempt - 1) * NOTION_BACKOFF_MS;
};

const sleep = async (ms: number): Promise<void> => {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};

const parseNotionError = async (res: Response): Promise<{ message: string; code?: string }> => {
  const fallbackMessage = `Notion API request failed with status ${res.status}`;

  try {
    const text = await res.text();
    if (!text) {
      return { message: fallbackMessage };
    }

    try {
      const json = JSON.parse(text) as any;
      const message = typeof json?.message === "string" ? json.message : fallbackMessage;
      const code = typeof json?.code === "string" ? json.code : undefined;
      return { message, code };
    } catch {
      return { message: `${fallbackMessage}: ${text}` };
    }
  } catch {
    return { message: fallbackMessage };
  }
};

const notionFetch = async (
  url: string,
  init: RequestInit,
  config: TIntegrationNotionConfig
): Promise<Response> => {
  const baseHeaders = getHeaders(config);
  const mergedHeaders = new Headers(init.headers);
  Object.entries(baseHeaders).forEach(([key, value]) => {
    if (!mergedHeaders.has(key)) mergedHeaders.set(key, value);
  });

  for (let attempt = 1; attempt <= NOTION_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: mergedHeaders,
      });

      if (res.ok) {
        return res;
      }

      const requestId = getNotionRequestId(res.headers);
      const { message, code } = await parseNotionError(res);
      const errorMessage = requestId ? `${message} (requestId: ${requestId})` : message;
      const error = new NotionApiError(errorMessage, { status: res.status, code, requestId });

      if (attempt < NOTION_MAX_ATTEMPTS && isRetryableNotionStatus(res.status)) {
        await sleep(getRetryDelayMs(attempt, res.headers));
        continue;
      }

      throw error;
    } catch (error) {
      // fetch() throws TypeError on network errors.
      if (attempt < NOTION_MAX_ATTEMPTS && error instanceof TypeError) {
        await sleep(getRetryDelayMs(attempt));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Notion API request failed after retries");
};

const fetchPages = async (config: TIntegrationNotionConfig) => {
  try {
    const res = await notionFetch(
      "https://api.notion.com/v1/search",
      {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
          filter: {
            value: "database",
            property: "object",
          },
        }),
      },
      config
    );
    return (await res.json()).results;
  } catch (error) {
    throw error;
  }
};

export const getNotionDatabases = async (environmentId: string): Promise<TIntegrationNotionDatabase[]> => {
  let results: TIntegrationNotionDatabase[] = [];
  try {
    const notionIntegration = (await getIntegrationByType(environmentId, "notion")) as TIntegrationNotion;
    if (notionIntegration && notionIntegration.config?.key.bot_id) {
      results = await fetchPages(notionIntegration.config);
    }
    return results;
  } catch (error) {
    throw error;
  }
};

export const writeData = async (
  databaseId: string,
  properties: Record<string, Object>,
  config: TIntegrationNotionConfig
) => {
  try {
    await notionFetch(
      `https://api.notion.com/v1/pages`,
      {
        method: "POST",
        body: JSON.stringify({
          parent: {
            database_id: databaseId,
          },
          properties: properties,
        }),
      },
      config
    );
  } catch (error) {
    throw error;
  }
};

const getHeaders = (config: TIntegrationNotionConfig) => {
  const decryptedToken = symmetricDecrypt(config.key.access_token, ENCRYPTION_KEY!);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${decryptedToken}`,
    "Notion-Version": "2022-06-28",
  };
};
