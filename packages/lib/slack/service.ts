import { Prisma } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TSlackChannel, TSlackCredential, TSlackIntegration } from "@formbricks/types/integration/slack";

export const fetchChannels = async (key: TSlackCredential): Promise<TSlackChannel[]> => {
  const response = await fetch("https://slack.com/api/conversations.list", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key.access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error);
  }

  return data.channels.map((channel: { name: string; id: string }) => ({
    name: channel.name,
    id: channel.id,
  }));
};

export const getSlackChannels = async (environmentId: string): Promise<TSlackChannel[]> => {
  let channels: TSlackChannel[] = [];
  try {
    const slackIntegration = await getSlackIntegration(environmentId);
    if (slackIntegration && slackIntegration.config?.key) {
      channels = await fetchChannels(slackIntegration.config.key);
    }
    return channels;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};

export const getSlackIntegration = cache(async (environmentId: string): Promise<TSlackIntegration | null> => {
  try {
    const result = await prisma.integration.findUnique({
      where: {
        type_environmentId: {
          environmentId,
          type: "slack",
        },
      },
    });
    // Type Guard
    if (result && isSlackIntegration(result)) {
      return result as TSlackIntegration; // Explicit casting
    }
    return null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
});

function isSlackIntegration(integration: any): integration is TSlackIntegration {
  return integration.type === "slack";
}

export async function writeDataToSlack(credentials: TSlackCredential, channelId: string, values: string[][]) {
  try {
    const [responses, questions] = values;
    let blockResponse = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${questions[0]}`,
        },
      },
      {
        type: "divider",
      },
    ];
    for (let i = 0; i < values[0].length; i++) {
      let questionSection = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${questions[i]}*`,
        },
      };
      let responseSection = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${responses[i]}\n`,
        },
      };
      blockResponse.push(questionSection, responseSection);
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        blocks: blockResponse,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
}
