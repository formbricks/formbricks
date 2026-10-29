import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { createOwnedOrganization } from "@/modules/auth/lib/owned-organization";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  MULTI_ORG_DISABLED_MESSAGE,
  ORGANIZATION_CREATE_SIGNED_IN_MESSAGE,
  createV3Organization,
} from "./create";
import { getOrganizationCreationPolicy } from "./creation-policy";
import { ZV3OrganizationCreatedResource } from "./schemas";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));
vi.mock("@/modules/auth/lib/owned-organization", () => ({ createOwnedOrganization: vi.fn() }));
vi.mock("@/modules/agent-setup/urls", () => ({
  getSetupGuideUrl: vi.fn(() => "https://app.example.com/agents/setup.md"),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("./creation-policy", () => ({ getOrganizationCreationPolicy: vi.fn() }));

const requestId = "req_1";
const instance = "/api/mcp";
const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const personUser = { id: "user_1", name: "Olivia", email: "olivia@example.com" };
const person = { user: personUser, expires: "2099-01-01" } as never;
const apiKey = { apiKeyId: "key_1", organizationId: "org_1", workspacePermissions: [] } as never;

const policy = (overrides: Partial<Awaited<ReturnType<typeof getOrganizationCreationPolicy>>> = {}) => {
  const value = { hasNoOrganizations: false, isMultiOrgEnabled: true, allowed: true, ...overrides };
  vi.mocked(getOrganizationCreationPolicy).mockResolvedValue(value);
};

const run = (
  body: unknown,
  authentication: unknown = person,
  auditLog?: Record<string, unknown>
): Promise<Response> =>
  createV3Organization({
    body,
    authentication: authentication as never,
    requestId,
    instance,
    auditLog: auditLog as never,
  });

describe("createV3Organization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    policy();
    vi.mocked(createOwnedOrganization).mockResolvedValue({ id: organizationId, name: "Acme" } as never);
  });

  test("creates the organization through the shared owner creation and answers 201 with the guide pointer", async () => {
    const response = await run({ name: "  Acme  " });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/organizations/${organizationId}`);
    const { data } = await response.json();
    expect(ZV3OrganizationCreatedResource.safeParse(data).success).toBe(true);
    expect(data).toMatchObject({
      id: organizationId,
      name: "Acme",
      role: "owner",
      workspaceCount: 0,
      setupGuideUrl: "https://app.example.com/agents/setup.md",
    });
    expect(data.nextStep).toMatch(/Path A/);
    // The name is trimmed by the body schema before it reaches the creation. A session user has no
    // notification settings, so the sign-up default of unsubscribing is not applied.
    expect(createOwnedOrganization).toHaveBeenCalledExactlyOnceWith(personUser, {
      name: "Acme",
      isFirstOrganization: false,
      unsubscribeFromNotifications: false,
    });
  });

  test("creates no workspace: the result says zero and no workspace module is imported by the operation", async () => {
    const source = readFileSync(path.resolve(__dirname, "create.ts"), "utf8");

    expect(source).not.toMatch(/createWorkspace|workspaces\/settings/);
    expect((await (await run({ name: "Acme" })).json()).data.workspaceCount).toBe(0);
  });

  test("an API key is refused with 403 before anything is read or written", async () => {
    const response = await run({ name: "Acme" }, apiKey);

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(ORGANIZATION_CREATE_SIGNED_IN_MESSAGE);
    expect(getOrganizationCreationPolicy).not.toHaveBeenCalled();
    expect(applyRateLimit).not.toHaveBeenCalled();
    expect(createOwnedOrganization).not.toHaveBeenCalled();
  });

  test("no authentication is 401", async () => {
    const response = await run({ name: "Acme" }, null);

    expect(response.status).toBe(401);
    expect(createOwnedOrganization).not.toHaveBeenCalled();
  });

  test("a session without a user id is not a signed-in person", async () => {
    const response = await run({ name: "Acme" }, { user: {}, expires: "2099-01-01" });

    expect(response.status).toBe(403);
    expect(createOwnedOrganization).not.toHaveBeenCalled();
  });

  test("an invalid body is 400 and nothing is written: empty, unknown key, too long, wrong type", async () => {
    for (const body of [
      { name: "   " },
      {},
      { name: "Acme", role: "owner" },
      { name: "x".repeat(256) },
      null,
    ]) {
      expect((await run(body)).status).toBe(400);
    }
    expect(createOwnedOrganization).not.toHaveBeenCalled();
  });

  test("with multi-organization off and organizations already present, 403 with the licence message", async () => {
    policy({ allowed: false, hasNoOrganizations: false, isMultiOrgEnabled: false });

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(MULTI_ORG_DISABLED_MESSAGE);
    expect(applyRateLimit).not.toHaveBeenCalled();
    expect(createOwnedOrganization).not.toHaveBeenCalled();
  });

  test("on a fresh instance the first organization is allowed without the licence and flagged as the first", async () => {
    policy({ allowed: true, hasNoOrganizations: true, isMultiOrgEnabled: false });

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(201);
    expect(createOwnedOrganization).toHaveBeenCalledWith(
      personUser,
      expect.objectContaining({ isFirstOrganization: true })
    );
  });

  test("applies the per-user create rate limit, and a spent limit is 429 with nothing created", async () => {
    await run({ name: "Acme" });
    expect(applyRateLimit).toHaveBeenCalledExactlyOnceWith(
      rateLimitConfigs.actions.createOrganization,
      "user_1"
    );

    vi.resetAllMocks();
    policy();
    vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("slow down", 30));

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(429);
    expect(createOwnedOrganization).not.toHaveBeenCalled();
  });

  test("records the new organization in the audit log", async () => {
    const auditLog: Record<string, unknown> = {};

    await run({ name: "Acme" }, person, auditLog);

    expect(auditLog).toMatchObject({
      organizationId,
      targetId: organizationId,
      newObject: { id: organizationId, name: "Acme" },
    });
  });

  test("leaves the audit log untouched when nothing was created", async () => {
    policy({ allowed: false, isMultiOrgEnabled: false });
    const auditLog: Record<string, unknown> = {};

    await run({ name: "Acme" }, person, auditLog);

    expect(auditLog).toEqual({});
  });

  test("a session without an email still creates the organization", async () => {
    const response = await run({ name: "Acme" }, { user: { id: "user_1" }, expires: "2099-01-01" });

    expect(response.status).toBe(201);
  });

  test("an unexpected failure while creating (including a rolled-back membership) answers 500 instead of throwing", async () => {
    vi.mocked(createOwnedOrganization).mockRejectedValue(new Error("database down"));
    const auditLog: Record<string, unknown> = {};

    const response = await run({ name: "Acme" }, person, auditLog);

    expect(response.status).toBe(500);
    expect(auditLog).toEqual({});
  });
});
