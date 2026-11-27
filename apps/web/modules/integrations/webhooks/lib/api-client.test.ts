import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { createWebhook, deleteWebhook, testWebhookEndpoint, updateWebhook } from "./api-client";

const WORKSPACE_ID = "clwork1111111111111111111";
const WEBHOOK_ID = "clhook1111111111111111111";
const BASE = "/api/internal/webhooks";

const settings = {
  name: "Orders",
  url: "https://hooks.example.com/formbricks",
  source: "user" as const,
  triggers: ["responseFinished" as const],
  surveyIds: [],
};

const call = (index = 0) => vi.mocked(global.fetch).mock.calls[index];
const sentBody = (index = 0) => JSON.parse(String(call(index)[1]?.body));

describe("webhooks API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs a new webhook to its workspace and returns it with its secret", async () => {
    const created = { id: WEBHOOK_ID, ...settings, workspaceId: WORKSPACE_ID, secret: "whsec_x" };
    routeFetch({ [`POST ${BASE}?workspaceId=${WORKSPACE_ID}`]: [json({ data: created }, 201)] });

    expect(
      await createWebhook({ workspaceId: WORKSPACE_ID, body: { ...settings, secret: "whsec_x" } })
    ).toEqual(created);
    expect(sentBody()).toEqual({ ...settings, secret: "whsec_x" });
  });

  test("PUTs a webhook's settings and DELETEs a webhook by id", async () => {
    routeFetch({
      [`PUT ${BASE}/${WEBHOOK_ID}`]: [json(null, 204)],
      [`DELETE ${BASE}/${WEBHOOK_ID}`]: [json(null, 204)],
    });

    await expect(updateWebhook({ webhookId: WEBHOOK_ID, body: settings })).resolves.toBeUndefined();
    expect(sentBody()).toEqual(settings);
    await expect(deleteWebhook(WEBHOOK_ID)).resolves.toBeUndefined();
  });

  test("POSTs an endpoint test without a client timeout, since the server times the endpoint", async () => {
    routeFetch({
      [`POST ${BASE}/test-deliveries?workspaceId=${WORKSPACE_ID}`]: [json({ data: { secret: "whsec_x" } })],
    });

    expect(
      await testWebhookEndpoint({
        workspaceId: WORKSPACE_ID,
        body: { url: settings.url, webhookId: WEBHOOK_ID },
      })
    ).toEqual({ secret: "whsec_x" });
    expect(sentBody()).toEqual({ url: settings.url, webhookId: WEBHOOK_ID });
    expect(call()[1]?.signal).toBeUndefined();
  });

  test("surfaces the server's reason for a failed endpoint test", async () => {
    const detail = "Webhook URL must not point to private or internal IP addresses";
    routeFetch({
      [`POST ${BASE}/test-deliveries?workspaceId=${WORKSPACE_ID}`]: [json({ status: 422, detail }, 422)],
    });

    const failure = testWebhookEndpoint({ workspaceId: WORKSPACE_ID, body: { url: "http://127.0.0.1" } });
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 422, detail });
  });
});
