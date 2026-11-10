import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { DELETE, PATCH } from "./[contactAttributeKeyId]/route";
import { POST } from "./route";
import {
  ATTRIBUTE_DESCRIPTION_MAX_LENGTH,
  ATTRIBUTE_KEY_MAX_LENGTH,
  ATTRIBUTE_NAME_MAX_LENGTH,
} from "./schemas";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  createContactAttributeKey: vi.fn(),
  updateContactAttributeKey: vi.fn(),
  deleteContactAttributeKey: vi.fn(),
  getContactAttributeKeyById: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.getIsContactsEnabled }));
vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  createContactAttributeKey: mocks.createContactAttributeKey,
  updateContactAttributeKey: mocks.updateContactAttributeKey,
  deleteContactAttributeKey: mocks.deleteContactAttributeKey,
  getContactAttributeKeyById: mocks.getContactAttributeKeyById,
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    targetId: "unknown",
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const KEY_ID = "clkey11111111111111111111";
const DATE = new Date("2026-10-01T10:00:00.000Z");

const storedKey = (overrides: Record<string, unknown> = {}) => ({
  id: KEY_ID,
  createdAt: DATE,
  updatedAt: DATE,
  isUnique: false,
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  type: "custom",
  dataType: "string",
  workspaceId: WORKSPACE_ID,
  ...overrides,
});

const existingKey = {
  id: KEY_ID,
  workspaceId: WORKSPACE_ID,
  type: "custom",
  name: "Plan tier",
  description: null,
};

const createBody = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: WORKSPACE_ID,
  key: "plan_tier",
  name: "Plan tier",
  dataType: "string",
  ...overrides,
});

const BASE = "http://localhost/api/internal/contact-attribute-keys";

const create = (body: unknown, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

const update = (
  body: unknown,
  { id = KEY_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  PATCH(
    new NextRequest(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ contactAttributeKeyId: id }) } as never
  );

const remove = ({ id = KEY_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  DELETE(new NextRequest(`${BASE}/${id}`, { method: "DELETE", headers }), {
    params: Promise.resolve({ contactAttributeKeyId: id }),
  } as never);

const checkedActions = () => mocks.assertCan.mock.calls.map(([, action, resource]) => [action, resource]);

const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: ORG_ID });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getIsContactsEnabled.mockResolvedValue(true);
  mocks.createContactAttributeKey.mockResolvedValue(storedKey());
  mocks.updateContactAttributeKey.mockResolvedValue(storedKey({ name: "Tier" }));
  mocks.deleteContactAttributeKey.mockResolvedValue(storedKey());
  mocks.getContactAttributeKeyById.mockResolvedValue(existingKey);
});

describe("POST /api/internal/contact-attribute-keys", () => {
  test("creates the key where contacts are licensed, audits it and captures it in PostHog", async () => {
    const response = await create(createBody({ description: "Billing plan" }));

    expect(response.status).toBe(201);
    expect((await response.json()).data).toMatchObject({
      id: KEY_ID,
      key: "plan_tier",
      createdAt: DATE.toISOString(),
    });
    expect(checkedActions()).toEqual([["workspace.write", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.createContactAttributeKey).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      key: "plan_tier",
      name: "Plan tier",
      description: "Billing plan",
      dataType: "string",
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "contactAttributeKey",
        status: "success",
        organizationId: ORG_ID,
        newObject: storedKey(),
      })
    );
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "contact_attribute_key_created",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, key: "plan_tier" },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("refuses where contacts aren't licensed, with the reason, after the budget", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await create(createBody());

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Contacts are not enabled for this organization");
    expect(operationLimits()).toHaveLength(1);
    expect(mocks.createContactAttributeKey).not.toHaveBeenCalled();
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 to a caller who may not write the workspace, before the licence", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    const response = await create(createBody());

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(operationLimits()).toEqual([]);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", status: "failure" })
    );
  });

  test("answers 422 with the service's reason for a key the workspace already has", async () => {
    mocks.createContactAttributeKey.mockRejectedValue(new InvalidInputError("Attribute key already exists"));

    const response = await create(createBody());

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Attribute key already exists");
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("answers 429 when the workspace's write budget is spent", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await create(createBody())).status).toBe(429);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.createContactAttributeKey).not.toHaveBeenCalled();
  });

  test.each([
    ["a key that isn't a safe identifier", createBody({ key: "Plan Tier" })],
    ["a key reserved for a future default attribute", createBody({ key: "first_name" })],
    ["a key past the cap", createBody({ key: "a".repeat(ATTRIBUTE_KEY_MAX_LENGTH + 1) })],
    ["a name past the cap", createBody({ name: "a".repeat(ATTRIBUTE_NAME_MAX_LENGTH + 1) })],
    [
      "a description past the cap",
      createBody({ description: "a".repeat(ATTRIBUTE_DESCRIPTION_MAX_LENGTH + 1) }),
    ],
    ["a name with a NUL character", createBody({ name: "a\u0000b" })],
    ["an unknown data type", createBody({ dataType: "boolean" })],
    ["an unknown key", { ...createBody(), isUnique: true }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createContactAttributeKey).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await create(createBody(), { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.createContactAttributeKey).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await create(createBody())).status).toBe(401);
  });
});

describe("PATCH /api/internal/contact-attribute-keys/{contactAttributeKeyId}", () => {
  test("relabels the key in its own workspace, and audits the old key and the saved one", async () => {
    const response = await update({ name: "Tier", description: "Plan" });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ id: KEY_ID, name: "Tier" });
    expect(checkedActions()).toEqual([["workspace.write", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.updateContactAttributeKey).toHaveBeenCalledWith(KEY_ID, {
      name: "Tier",
      description: "Plan",
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "contactAttributeKey",
        status: "success",
        organizationId: ORG_ID,
        oldObject: existingKey,
        newObject: storedKey({ name: "Tier" }),
      })
    );
  });

  test("answers the uniform 403 for a key that doesn't exist", async () => {
    mocks.getContactAttributeKeyById.mockResolvedValue(null);

    const response = await update({ name: "Tier" });

    expect(response.status).toBe(403);
    expect(mocks.assertCan).not.toHaveBeenCalled();
    expect(mocks.updateContactAttributeKey).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 to a caller who may not write the key's workspace", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await update({ name: "Tier" })).status).toBe(403);
    expect(mocks.updateContactAttributeKey).not.toHaveBeenCalled();
  });

  test("refuses where contacts aren't licensed, with the reason", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await update({ name: "Tier" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Contacts are not enabled for this organization");
    expect(mocks.updateContactAttributeKey).not.toHaveBeenCalled();
  });

  test("refuses a default key, with the reason", async () => {
    mocks.updateContactAttributeKey.mockRejectedValue(
      new OperationNotAllowedError("Cannot update default contact attribute key")
    );

    const response = await update({ name: "Email" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Cannot update default contact attribute key");
  });

  test("answers the uniform 403 for a key deleted meanwhile", async () => {
    mocks.updateContactAttributeKey.mockRejectedValue(
      new ResourceNotFoundError("contactAttributeKey", KEY_ID)
    );
    expect((await update({ name: "Tier" })).status).toBe(403);
  });

  test.each([
    ["an unknown key", { name: "Tier", key: "tier" }],
    ["a description past the cap", { description: "a".repeat(ATTRIBUTE_DESCRIPTION_MAX_LENGTH + 1) }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await update(body)).status).toBe(400);
    expect(mocks.updateContactAttributeKey).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await update({ name: "Tier" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(
      403
    );
    expect(mocks.updateContactAttributeKey).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/contact-attribute-keys/{contactAttributeKeyId}", () => {
  test("deletes the key in its own workspace, and audits the key as it was", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(checkedActions()).toEqual([["workspace.write", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.deleteContactAttributeKey).toHaveBeenCalledWith(KEY_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "contactAttributeKey",
        status: "success",
        organizationId: ORG_ID,
        oldObject: existingKey,
      })
    );
  });

  test("answers the uniform 403 for a key that doesn't exist", async () => {
    mocks.getContactAttributeKeyById.mockResolvedValue(null);
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteContactAttributeKey).not.toHaveBeenCalled();
  });

  test("refuses where contacts aren't licensed", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteContactAttributeKey).not.toHaveBeenCalled();
  });

  test("refuses a default key, with the reason", async () => {
    mocks.deleteContactAttributeKey.mockRejectedValue(
      new OperationNotAllowedError("Cannot delete default contact attribute key")
    );

    const response = await remove();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Cannot delete default contact attribute key");
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deleted", status: "failure", oldObject: existingKey })
    );
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.deleteContactAttributeKey).not.toHaveBeenCalled();
  });
});
