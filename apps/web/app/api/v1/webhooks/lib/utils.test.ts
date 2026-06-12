import { describe, expect, test } from "vitest";
import { Webhook } from "@formbricks/database/prisma";
import { removeSecretFromWebhook } from "./utils";

describe("removeSecretFromWebhook", () => {
  const webhook: Webhook = {
    id: "ja9w8amczcz0044dz6t9bnv7",
    name: "My Webhook",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    url: "https://example.com/webhook",
    source: "user",
    workspaceId: "tu27truyfhg6me9aq00fbcs9",
    triggers: ["responseCreated"],
    surveyIds: ["xh34cbttpcj81oyl0bwlnzlh"],
    secret: "whsec_super_secret_value",
  };

  test("removes the secret from the webhook", () => {
    const result = removeSecretFromWebhook(webhook);
    expect(result).not.toHaveProperty("secret");
  });

  test("keeps all other webhook fields", () => {
    const result = removeSecretFromWebhook(webhook);
    const { secret, ...expected } = webhook;
    expect(result).toEqual(expected);
  });
});
