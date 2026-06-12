import { describe, expect, test, vi } from "vitest";
import { Webhook } from "@formbricks/database/prisma";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetWebhooksFilter } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { getWebhooksQuery, removeSecretFromWebhook } from "../utils";

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  pickCommonFilter: vi.fn(),
  buildCommonFilterQuery: vi.fn(),
}));

describe("getWebhooksQuery", () => {
  const workspaceId = "ws-123";

  test("adds surveyIds condition when provided", () => {
    const params = { surveyIds: ["survey1"] } as TGetWebhooksFilter;
    const result = getWebhooksQuery([workspaceId], params);
    expect(result).toBeDefined();
    expect(result?.where).toMatchObject({
      workspaceId: { in: [workspaceId] },
      surveyIds: { hasSome: ["survey1"] },
    });
  });

  test("calls pickCommonFilter and buildCommonFilterQuery when baseFilter is present", () => {
    vi.mocked(pickCommonFilter).mockReturnValue({ someFilter: "test" } as any);
    getWebhooksQuery([workspaceId], { surveyIds: ["survey1"] } as TGetWebhooksFilter);
    expect(pickCommonFilter).toHaveBeenCalled();
    expect(buildCommonFilterQuery).toHaveBeenCalled();
  });

  test("buildCommonFilterQuery is not called if no baseFilter is picked", () => {
    vi.mocked(pickCommonFilter).mockReturnValue(undefined as any);
    getWebhooksQuery([workspaceId], {} as any);
    expect(buildCommonFilterQuery).not.toHaveBeenCalled();
  });
});

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
