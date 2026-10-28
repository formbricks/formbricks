import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { findNewlyAttachedNotWorkspaceVisibleSurveyIds } from "@/lib/survey/visibility/outbound";
import { sendSignedWebhookRequest } from "@/modules/integrations/webhooks/lib/send-signed-webhook";
import {
  createV3Webhook,
  deleteV3Webhook,
  getV3Webhook,
  listV3Webhooks,
  testV3Webhook,
  updateV3Webhook,
} from "./operations";
import {
  createWorkspaceWebhook,
  deleteWorkspaceWebhook,
  findWebhookById,
  findWorkspaceSurveyIds,
  getWebhookDeliveryTarget,
  listWorkspaceWebhooks,
  updateWorkspaceWebhook,
} from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("./service", () => ({
  createWorkspaceWebhook: vi.fn(),
  deleteWorkspaceWebhook: vi.fn(),
  findWebhookById: vi.fn(),
  findWorkspaceSurveyIds: vi.fn(),
  getWebhookDeliveryTarget: vi.fn(),
  listWorkspaceWebhooks: vi.fn(),
  updateWorkspaceWebhook: vi.fn(),
}));
vi.mock("@/lib/survey/visibility/outbound", () => ({
  findNewlyAttachedNotWorkspaceVisibleSurveyIds: vi.fn(),
}));
// The real SSRF policy runs in these tests (IP literals need no DNS); only the operator switch is pinned.
vi.mock("@/lib/constants", () => ({
  DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: false,
  WEBHOOK_DELIVERY_TIMEOUT_MS: 5000,
}));
vi.mock("@/modules/integrations/webhooks/lib/send-signed-webhook", () => ({
  sendSignedWebhookRequest: vi.fn(),
  WebhookDeliveryTimeoutError: class WebhookDeliveryTimeoutError extends Error {
    readonly timeoutMs = 5000;
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const { WebhookDeliveryTimeoutError } =
  await import("@/modules/integrations/webhooks/lib/send-signed-webhook");

const workspaceId = "clxx1234567890123456789012";
const organizationId = "clzz1234567890123456789012";
const webhookId = "clwh1234567890123456789012";
const surveyId = "clsv1234567890123456789012";
const otherSurveyId = "clsw1234567890123456789012";
const SECRET = "whsec_super-secret-value";

const stored = {
  id: webhookId,
  workspaceId,
  name: "Slack bridge",
  url: "https://hooks.example.com/formbricks",
  source: "user" as const,
  triggers: ["responseFinished" as const],
  surveyIds: [surveyId],
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
};

const base = { authentication: null, requestId: "req_1", instance: "/api/v3/webhooks" };

// A public IP literal, so the real SSRF policy accepts it without a DNS lookup.
const createBody = {
  workspaceId,
  url: "https://93.184.216.34/formbricks",
  source: "user" as const,
  triggers: ["responseFinished" as const],
  surveyIds: [surveyId],
};

const grantAccess = () =>
  vi
    .mocked(requireV3WorkspaceAccess)
    .mockResolvedValue({ workspaceId, organizationId } as Awaited<
      ReturnType<typeof requireV3WorkspaceAccess>
    >);

const newAuditLog = () => ({ status: "failure" }) as unknown as TV3AuditLog;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findWorkspaceSurveyIds).mockImplementation(async (_workspace, ids) => new Set(ids));
  vi.mocked(findNewlyAttachedNotWorkspaceVisibleSurveyIds).mockResolvedValue([]);
});

describe("listV3Webhooks", () => {
  test("lists the authorized workspace's webhooks and nothing of a secret", async () => {
    grantAccess();
    vi.mocked(listWorkspaceWebhooks).mockResolvedValue([stored]);

    const response = await listV3Webhooks({ ...base, workspaceId, limit: 50 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(null, workspaceId, "read", "req_1", base.instance);
    expect(listWorkspaceWebhooks).toHaveBeenCalledWith(workspaceId);
    expect(body.data[0]).toMatchObject({ id: webhookId, url: stored.url });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  test("a caller without access to the workspace lists nothing", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await listV3Webhooks({ ...base, workspaceId, limit: 50 });

    expect(response.status).toBe(403);
    expect(listWorkspaceWebhooks).not.toHaveBeenCalled();
  });
});

describe("getV3Webhook", () => {
  test("authorizes against the webhook's own workspace and omits the secret", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();

    const response = await getV3Webhook({ ...base, webhookId });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(null, workspaceId, "read", "req_1", base.instance);
    expect(Object.keys(body.data)).not.toContain("secret");
  });

  test("an unknown webhook is a 403, the same as one the caller cannot reach", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(null);

    const response = await getV3Webhook({ ...base, webhookId });

    expect(response.status).toBe(403);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("a webhook in a workspace the caller cannot read is refused", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await getV3Webhook({ ...base, webhookId });

    expect(response.status).toBe(403);
  });
});

describe("createV3Webhook", () => {
  test("creates in the authorized workspace, returns the secret once and audits without it", async () => {
    grantAccess();
    vi.mocked(createWorkspaceWebhook).mockResolvedValue({ ...stored, secret: SECRET });
    const auditLog = newAuditLog();

    const response = await createV3Webhook({ ...base, body: createBody, auditLog });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/webhooks/${webhookId}`);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      "req_1",
      base.instance
    );
    expect(body.data.secret).toBe(SECRET);
    expect(auditLog.targetId).toBe(webhookId);
    expect(auditLog.organizationId).toBe(organizationId);
    expect(JSON.stringify(auditLog)).not.toContain(SECRET);
    expect(Object.keys(auditLog.newObject as object)).not.toContain("secret");
  });

  test("a caller without write access creates nothing", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await createV3Webhook({ ...base, body: createBody });

    expect(response.status).toBe(403);
    expect(createWorkspaceWebhook).not.toHaveBeenCalled();
  });

  test.each([
    ["loopback", "http://127.0.0.1/hook"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data"],
    ["private range", "https://10.0.0.5/hook"],
    ["localhost name", "http://localhost:3000/hook"],
    ["IPv6 loopback", "http://[::1]/hook"],
    ["IPv4-mapped loopback", "http://[::ffff:127.0.0.1]/hook"],
    ["unsupported scheme", "ftp://hooks.example.com/hook"],
  ])("refuses a %s target with a 422 naming the url, and stores nothing", async (_label, url) => {
    grantAccess();

    const response = await createV3Webhook({ ...base, body: { ...createBody, url } });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.invalid_params).toEqual([expect.objectContaining({ name: "url" })]);
    expect(createWorkspaceWebhook).not.toHaveBeenCalled();
  });

  test("refuses a Discord webhook URL, which deliveries do not support", async () => {
    grantAccess();

    const response = await createV3Webhook({
      ...base,
      body: { ...createBody, url: "https://discord.com/api/webhooks/123/token" },
    });

    expect(response.status).toBe(422);
    expect(createWorkspaceWebhook).not.toHaveBeenCalled();
  });

  test("refuses a survey that is not in the workspace, whether it exists elsewhere or not", async () => {
    grantAccess();
    vi.mocked(findWorkspaceSurveyIds).mockResolvedValue(new Set([surveyId]));

    const response = await createV3Webhook({
      ...base,
      body: { ...createBody, surveyIds: [surveyId, otherSurveyId] },
    });
    const body = await response.json();

    expect(findWorkspaceSurveyIds).toHaveBeenCalledWith(workspaceId, [surveyId, otherSurveyId]);
    expect(response.status).toBe(422);
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "surveyIds", code: "dangling_reference", missingId: otherSurveyId }),
    ]);
    expect(createWorkspaceWebhook).not.toHaveBeenCalled();
  });

  test("refuses a survey that is not visible to the whole workspace", async () => {
    grantAccess();
    vi.mocked(findNewlyAttachedNotWorkspaceVisibleSurveyIds).mockResolvedValue([surveyId]);

    const response = await createV3Webhook({ ...base, body: createBody });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("survey_not_workspace_visible");
    expect(createWorkspaceWebhook).not.toHaveBeenCalled();
  });
});

describe("updateV3Webhook", () => {
  test("changes only what was sent and never answers a secret", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();
    vi.mocked(updateWorkspaceWebhook).mockResolvedValue({ ...stored, name: "Renamed" });
    const auditLog = newAuditLog();

    const response = await updateV3Webhook({ ...base, webhookId, body: { name: "Renamed" }, auditLog });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      "req_1",
      base.instance
    );
    expect(updateWorkspaceWebhook).toHaveBeenCalledWith(workspaceId, webhookId, { name: "Renamed" });
    expect(body.data.name).toBe("Renamed");
    expect(Object.keys(body.data)).not.toContain("secret");
    expect(auditLog.targetId).toBe(webhookId);
    expect(auditLog.oldObject).toMatchObject({ name: "Slack bridge" });
    expect(auditLog.newObject).toMatchObject({ name: "Renamed" });
  });

  test("an empty patch is a 400 and writes nothing", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();

    const response = await updateV3Webhook({ ...base, webhookId, body: {} });

    expect(response.status).toBe(400);
    expect(updateWorkspaceWebhook).not.toHaveBeenCalled();
  });

  test("refuses a new URL that points inside the network and keeps the stored one", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();

    const response = await updateV3Webhook({
      ...base,
      webhookId,
      body: { url: "http://169.254.169.254/latest/meta-data" },
    });

    expect(response.status).toBe(422);
    expect(updateWorkspaceWebhook).not.toHaveBeenCalled();
  });

  test("checks surveys against the webhook's workspace and only the newly attached ones for visibility", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();
    vi.mocked(updateWorkspaceWebhook).mockResolvedValue({ ...stored, surveyIds: [surveyId, otherSurveyId] });

    await updateV3Webhook({ ...base, webhookId, body: { surveyIds: [surveyId, otherSurveyId] } });

    expect(findWorkspaceSurveyIds).toHaveBeenCalledWith(workspaceId, [surveyId, otherSurveyId]);
    expect(findNewlyAttachedNotWorkspaceVisibleSurveyIds).toHaveBeenCalledWith(
      [surveyId, otherSurveyId],
      [surveyId]
    );
  });

  test("refuses a survey of another workspace", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();
    vi.mocked(findWorkspaceSurveyIds).mockResolvedValue(new Set());

    const response = await updateV3Webhook({ ...base, webhookId, body: { surveyIds: [otherSurveyId] } });

    expect(response.status).toBe(422);
    expect(updateWorkspaceWebhook).not.toHaveBeenCalled();
  });

  test("a caller without write access to the webhook's workspace changes nothing", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await updateV3Webhook({ ...base, webhookId, body: { name: "x" } });

    expect(response.status).toBe(403);
    expect(updateWorkspaceWebhook).not.toHaveBeenCalled();
  });
});

describe("deleteV3Webhook", () => {
  test("deletes inside the webhook's workspace and audits the removed webhook without a secret", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();
    vi.mocked(deleteWorkspaceWebhook).mockResolvedValue(stored);
    const auditLog = newAuditLog();

    const response = await deleteV3Webhook({ ...base, webhookId, auditLog });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: webhookId });
    expect(deleteWorkspaceWebhook).toHaveBeenCalledWith(workspaceId, webhookId);
    expect(auditLog.targetId).toBe(webhookId);
    expect(Object.keys(auditLog.oldObject as object)).not.toContain("secret");
  });

  test("a caller without write access deletes nothing", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await deleteV3Webhook({ ...base, webhookId });

    expect(response.status).toBe(403);
    expect(deleteWorkspaceWebhook).not.toHaveBeenCalled();
  });
});

describe("testV3Webhook", () => {
  const arrange = () => {
    vi.mocked(findWebhookById).mockResolvedValue(stored);
    grantAccess();
    vi.mocked(getWebhookDeliveryTarget).mockResolvedValue({ url: stored.url, secret: SECRET });
  };

  test("signs a delivery to the stored URL with the stored secret, and never answers the secret", async () => {
    arrange();
    vi.mocked(sendSignedWebhookRequest).mockResolvedValue({ statusCode: 200 });

    const response = await testV3Webhook({ ...base, webhookId });
    const text = await response.text();

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      "req_1",
      base.instance
    );
    expect(sendSignedWebhookRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: stored.url, secret: SECRET })
    );
    expect(JSON.parse(text).data).toEqual({ delivered: true, statusCode: 200, error: null });
    expect(text).not.toContain(SECRET);
  });

  test("reports a receiver error as a failed delivery, not an HTTP error", async () => {
    arrange();
    vi.mocked(sendSignedWebhookRequest).mockResolvedValue({ statusCode: 502 });

    const response = await testV3Webhook({ ...base, webhookId });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ delivered: false, statusCode: 502 });
  });

  test("a redirect is a failure, since deliveries do not follow one", async () => {
    arrange();
    vi.mocked(sendSignedWebhookRequest).mockResolvedValue({ statusCode: 301 });

    const body = await (await testV3Webhook({ ...base, webhookId })).json();

    expect(body.data).toMatchObject({ delivered: false, statusCode: 301 });
  });

  test("a target the SSRF policy now refuses is reported, not contacted", async () => {
    arrange();
    vi.mocked(sendSignedWebhookRequest).mockRejectedValue(
      new InvalidInputError("Webhook URL must not point to private or internal IP addresses")
    );

    const body = await (await testV3Webhook({ ...base, webhookId })).json();

    expect(body.data).toEqual({
      delivered: false,
      statusCode: null,
      error: "Webhook URL must not point to private or internal IP addresses",
    });
  });

  test("a timeout is reported with the wait, and an unknown failure does not leak its message", async () => {
    arrange();
    vi.mocked(sendSignedWebhookRequest).mockRejectedValueOnce(new WebhookDeliveryTimeoutError(5000));
    const timedOut = await (await testV3Webhook({ ...base, webhookId })).json();
    expect(timedOut.data.error).toContain("5 seconds");

    vi.mocked(sendSignedWebhookRequest).mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.1.2.3:443"));
    const failed = await (await testV3Webhook({ ...base, webhookId })).json();
    expect(failed.data.error).toBe("The endpoint could not be reached");
  });

  test("an unknown webhook or a caller without write access sends nothing", async () => {
    vi.mocked(findWebhookById).mockResolvedValue(null);
    expect((await testV3Webhook({ ...base, webhookId })).status).toBe(403);

    vi.mocked(findWebhookById).mockResolvedValue(stored);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));
    expect((await testV3Webhook({ ...base, webhookId })).status).toBe(403);

    expect(sendSignedWebhookRequest).not.toHaveBeenCalled();
  });
});
