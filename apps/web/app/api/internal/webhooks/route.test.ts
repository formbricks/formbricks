import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  UnknownError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { DELETE, PUT } from "./[webhookId]/route";
import { POST as CREATE } from "./route";
import { POST as TEST_DELIVERY } from "./test-deliveries/route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  capturePostHogEvent: vi.fn(),
  assertVisible: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getOrganizationIdFromWebhookId: vi.fn(),
  getWorkspaceIdFromWebhookId: vi.fn(),
  getWebhook: vi.fn(),
  getWebhookWithSecret: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testEndpoint: vi.fn(),
  generateWebhookSecret: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/lib/crypto", () => ({ generateWebhookSecret: mocks.generateWebhookSecret }));
vi.mock("@/lib/survey/visibility/outbound", () => ({
  assertNewlyAttachedSurveysWorkspaceVisible: mocks.assertVisible,
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getOrganizationIdFromWebhookId: mocks.getOrganizationIdFromWebhookId,
  getWorkspaceIdFromWebhookId: mocks.getWorkspaceIdFromWebhookId,
}));
vi.mock("@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook", () => ({
  getWebhook: mocks.getWebhook,
  getWebhookWithSecret: mocks.getWebhookWithSecret,
}));
vi.mock("@/modules/integrations/webhooks/lib/webhook", () => ({
  createWebhook: mocks.createWebhook,
  updateWebhook: mocks.updateWebhook,
  deleteWebhook: mocks.deleteWebhook,
  testEndpoint: mocks.testEndpoint,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const USER_ID = "cluser1111111111111111111";
const WEBHOOK_ID = "clhook1111111111111111111";
const SURVEY_ID = "clsurv1111111111111111111";

const settings = {
  name: "Orders",
  url: "https://hooks.example.com/formbricks",
  source: "user",
  triggers: ["responseFinished"],
  surveyIds: [SURVEY_ID],
};

const storedWebhook = {
  id: WEBHOOK_ID,
  ...settings,
  workspaceId: WORKSPACE_ID,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  secret: "whsec_stored",
};
const { secret: _storedSecret, ...webhookWithoutSecret } = storedWebhook;

const request = (method: string, path: string, body?: unknown, headers = SAME_ORIGIN_HEADERS) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(headers as Record<string, string>) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const create = (body: unknown, workspaceId = WORKSPACE_ID) =>
  CREATE(request("POST", `/api/internal/webhooks?workspaceId=${workspaceId}`, body), {
    params: Promise.resolve({}),
  } as never);
const update = (body: unknown, id = WEBHOOK_ID) =>
  PUT(request("PUT", `/api/internal/webhooks/${id}`, body), {
    params: Promise.resolve({ webhookId: id }),
  } as never);
const remove = (id = WEBHOOK_ID) =>
  DELETE(request("DELETE", `/api/internal/webhooks/${id}`), {
    params: Promise.resolve({ webhookId: id }),
  } as never);
const testDelivery = (body: unknown, workspaceId = WORKSPACE_ID) =>
  TEST_DELIVERY(request("POST", `/api/internal/webhooks/test-deliveries?workspaceId=${workspaceId}`, body), {
    params: Promise.resolve({}),
  } as never);

const stateMutationSpent = () =>
  mocks.applyRateLimit.mock.calls.some(([config]) => config === rateLimitConfigs.actions.stateMutation);
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const workspaceWriteOn = (workspaceId: string) =>
  expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "workspace.write", {
    type: "workspace",
    id: workspaceId,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.assertVisible.mockResolvedValue(undefined);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.getOrganizationIdFromWebhookId.mockResolvedValue(ORG_ID);
  mocks.getWorkspaceIdFromWebhookId.mockResolvedValue(WORKSPACE_ID);
  mocks.getWebhook.mockResolvedValue({ ok: true, data: webhookWithoutSecret });
  mocks.getWebhookWithSecret.mockResolvedValue({ ok: true, data: storedWebhook });
  mocks.createWebhook.mockResolvedValue(storedWebhook);
  mocks.updateWebhook.mockResolvedValue(true);
  mocks.deleteWebhook.mockResolvedValue(true);
  mocks.testEndpoint.mockResolvedValue(true);
  mocks.generateWebhookSecret.mockReturnValue("whsec_generated");
});

describe("POST /api/internal/webhooks", () => {
  test("creates the webhook with the tested secret, returns that secret once, and audits and tracks it", async () => {
    const response = await create({ ...settings, secret: "whsec_tested" });

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({
      id: WEBHOOK_ID,
      name: "Orders",
      url: settings.url,
      source: "user",
      workspaceId: WORKSPACE_ID,
      triggers: ["responseFinished"],
      surveyIds: [SURVEY_ID],
      secret: "whsec_stored",
    });
    workspaceWriteOn(WORKSPACE_ID);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);
    expect(mocks.assertVisible).toHaveBeenCalledWith([SURVEY_ID]);
    expect(mocks.createWebhook).toHaveBeenCalledWith(WORKSPACE_ID, settings, "whsec_tested");
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "integration_connected",
      { integration_type: "webhook", organization_id: ORG_ID, workspace_id: WORKSPACE_ID },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "created",
        targetType: "webhook",
        status: "success",
        organizationId: ORG_ID,
        targetId: WEBHOOK_ID,
        newObject: settings,
      })
    );
  });

  test("refuses a caller who can't write to the workspace before spending its budget", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await create(settings);

    expect(response.status).toBe(403);
    expect(stateMutationSpent()).toBe(false);
    expect(mocks.createWebhook).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(expect.objectContaining({ status: "failure", organizationId: ORG_ID }));
  });

  test("answers a missing workspace with the same 403", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockRejectedValue(
      new ResourceNotFoundError("workspace", WORKSPACE_ID)
    );

    const response = await create(settings);

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.createWebhook).not.toHaveBeenCalled();
  });

  test("answers a spent budget with 429", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Too many requests", 60));

    expect((await create(settings)).status).toBe(429);
    expect(mocks.createWebhook).not.toHaveBeenCalled();
  });

  test("refuses a newly attached survey that isn't workspace-visible, with the guard's reason", async () => {
    mocks.assertVisible.mockRejectedValue(new OperationNotAllowedError("restricted survey"));

    const response = await create(settings);

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("restricted survey");
    expect(mocks.createWebhook).not.toHaveBeenCalled();
  });

  test("shows the URL validator's reason as a 422", async () => {
    mocks.createWebhook.mockRejectedValue(
      new InvalidInputError("Webhook URL must not point to private or internal IP addresses")
    );

    const response = await create(settings);

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(
      "Webhook URL must not point to private or internal IP addresses"
    );
  });

  test("keeps a database failure's message out of the response", async () => {
    mocks.createWebhook.mockRejectedValue(new DatabaseError("relation webhook constraint xyz"));

    const response = await create(settings);

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("constraint");
  });

  test.each([
    ["an unknown key", { ...settings, workspaceId: WORKSPACE_ID }],
    ["no trigger", { ...settings, triggers: [] }],
    ["an over-long name", { ...settings, name: "n".repeat(256) }],
    ["an over-long URL", { ...settings, url: `https://example.com/${"a".repeat(4096)}` }],
    ["an over-long secret", { ...settings, secret: "s".repeat(1025) }],
  ])("rejects %s with 400", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createWebhook).not.toHaveBeenCalled();
  });

  test("refuses a cross-origin request", async () => {
    const response = await CREATE(
      request("POST", `/api/internal/webhooks?workspaceId=${WORKSPACE_ID}`, settings, {
        Origin: "https://evil.example",
      } as never),
      { params: Promise.resolve({}) } as never
    );

    expect(response.status).toBe(403);
    expect(mocks.createWebhook).not.toHaveBeenCalled();
  });
});

describe("PUT /api/internal/webhooks/{webhookId}", () => {
  test("authorizes the webhook's own workspace, guards only new surveys and audits before and after", async () => {
    mocks.getWebhook
      .mockResolvedValueOnce({
        ok: true,
        data: { ...webhookWithoutSecret, surveyIds: ["clold1111111111111111111"] },
      })
      .mockResolvedValueOnce({ ok: true, data: webhookWithoutSecret });

    const response = await update(settings);

    expect(response.status).toBe(204);
    workspaceWriteOn(WORKSPACE_ID);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);
    expect(mocks.assertVisible).toHaveBeenCalledWith([SURVEY_ID], ["clold1111111111111111111"]);
    expect(mocks.updateWebhook).toHaveBeenCalledWith(WEBHOOK_ID, settings);
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "updated",
        targetType: "webhook",
        status: "success",
        organizationId: ORG_ID,
        targetId: WEBHOOK_ID,
        oldObject: { ok: true, data: { ...webhookWithoutSecret, surveyIds: ["clold1111111111111111111"] } },
        newObject: { ok: true, data: webhookWithoutSecret },
      })
    );
  });

  test("answers a missing webhook with the uniform 403, audited against it", async () => {
    mocks.getOrganizationIdFromWebhookId.mockRejectedValue(new ResourceNotFoundError("webhook", WEBHOOK_ID));

    const response = await update(settings);

    expect(response.status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.updateWebhook).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(expect.objectContaining({ status: "failure", targetId: WEBHOOK_ID }));
  });

  test("refuses a caller who can't write to the webhook's workspace", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await update(settings)).status).toBe(403);
    expect(stateMutationSpent()).toBe(false);
    expect(mocks.updateWebhook).not.toHaveBeenCalled();
  });

  test("shows the URL validator's reason as a 422", async () => {
    mocks.updateWebhook.mockRejectedValue(
      new InvalidInputError("Webhook URL must use HTTPS or HTTP protocol")
    );

    const response = await update(settings);

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Webhook URL must use HTTPS or HTTP protocol");
  });
});

describe("DELETE /api/internal/webhooks/{webhookId}", () => {
  test("deletes the webhook and audits what it was", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    workspaceWriteOn(WORKSPACE_ID);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);
    expect(mocks.deleteWebhook).toHaveBeenCalledWith(WEBHOOK_ID);
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "deleted",
        targetType: "webhook",
        status: "success",
        organizationId: ORG_ID,
        targetId: WEBHOOK_ID,
        oldObject: { ok: true, data: webhookWithoutSecret },
      })
    );
  });

  test("answers a webhook deleted meanwhile with the uniform 403", async () => {
    mocks.deleteWebhook.mockRejectedValue(new ResourceNotFoundError("Webhook", WEBHOOK_ID));

    expect((await remove()).status).toBe(403);
  });

  test("refuses a caller who can't write to the webhook's workspace", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await remove()).status).toBe(403);
    expect(mocks.deleteWebhook).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/webhooks/test-deliveries", () => {
  const url = "https://hooks.example.com/formbricks";

  test("signs a new webhook's test with the secret it was given, and returns it", async () => {
    const response = await testDelivery({ url, secret: "whsec_tested" });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ secret: "whsec_tested" });
    workspaceWriteOn(WORKSPACE_ID);
    expect(mocks.testEndpoint).toHaveBeenCalledWith(url, "whsec_tested");
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("generates a secret for a new webhook that has none yet", async () => {
    const response = await testDelivery({ url });

    expect((await response.json()).data).toEqual({ secret: "whsec_generated" });
    expect(mocks.testEndpoint).toHaveBeenCalledWith(url, "whsec_generated");
  });

  test("signs an existing webhook's test with its stored secret, authorizing the webhook's own workspace", async () => {
    mocks.getWorkspaceIdFromWebhookId.mockResolvedValue(OTHER_WORKSPACE_ID);

    const response = await testDelivery({ url, webhookId: WEBHOOK_ID, secret: "whsec_ignored" });

    expect(response.status).toBe(200);
    workspaceWriteOn(OTHER_WORKSPACE_ID);
    expect(mocks.can).toHaveBeenCalledTimes(1);
    expect(mocks.testEndpoint).toHaveBeenCalledWith(url, "whsec_stored");
  });

  test("makes no request for a caller who can't write to the workspace", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await testDelivery({ url })).status).toBe(403);
    expect(mocks.testEndpoint).not.toHaveBeenCalled();
    expect(mocks.generateWebhookSecret).not.toHaveBeenCalled();
  });

  test("answers a missing webhook with the uniform 403 and makes no request", async () => {
    mocks.getWorkspaceIdFromWebhookId.mockRejectedValue(new ResourceNotFoundError("webhook", WEBHOOK_ID));

    expect((await testDelivery({ url, webhookId: WEBHOOK_ID })).status).toBe(403);
    expect(mocks.testEndpoint).not.toHaveBeenCalled();
  });

  test.each([
    "Webhook URL must not point to private or internal IP addresses",
    "Webhook endpoint returned a redirect, which is not allowed",
  ])("shows the endpoint test's refusal %j as a 422", async (reason) => {
    mocks.testEndpoint.mockRejectedValue(new InvalidInputError(reason));

    const response = await testDelivery({ url });

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(reason);
  });

  test("keeps a transport failure's text out of the response, as the action did", async () => {
    mocks.testEndpoint.mockRejectedValue(new UnknownError("Request timed out after 5 seconds"));

    const response = await testDelivery({ url });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("timed out");
  });

  test("rejects a missing URL or an unknown key with 400", async () => {
    expect((await testDelivery({})).status).toBe(400);
    expect((await testDelivery({ url, workspaceId: WORKSPACE_ID })).status).toBe(400);
    expect(mocks.testEndpoint).not.toHaveBeenCalled();
  });
});
