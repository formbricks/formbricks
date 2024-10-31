import { getWebhooks } from "webhook/service";
import { DatabaseError } from "@formbricks/types/errors";

export const writeDataToMattermost = async (
  serverURL: string,
  values: string[][],
  surveyName: string | undefined,
  meta: any
) => {
  try {
    const [responses, questions] = values;
    let markdownResponse = `#### Survey results for ${surveyName}\n---\n\n`;

    for (let i = 0; i < responses.length; i++) {
      markdownResponse += `${i + 1}. *${questions[i]}*\n`;
      markdownResponse += `${responses[i]}\n\n`;
    }

    const response = await fetch(`${serverURL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...JSON.parse(meta),
        text: markdownResponse,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.text();

    if (data !== "ok") {
      throw new Error(data);
    }
  } catch (error) {
    throw error;
  }
};

export const getMattermostWebhooks = async (environmentId: string) => {
  try {
    const webhooks = await getWebhooks(environmentId);

    const mattermostWebhooks = webhooks.filter((webhook) => {
      if (webhook.meta) {
        try {
          return JSON.parse(webhook.meta as string)?.webhook_type === "mattermost";
        } catch (e) {
          // Invalid JSON in meta; exclude this webhook
          return false;
        }
      } else {
        return false;
      }
    });

    return mattermostWebhooks;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw new DatabaseError(error.message);
    }
    throw new Error(error.message);
  }
};

export const getMattermostWebhookCount = async (environmentId: string) => {
  try {
    const mattermostWebhooks = await getMattermostWebhooks(environmentId);

    return mattermostWebhooks.length;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw new DatabaseError(error.message);
    }
    throw new Error(error.message);
  }
};
