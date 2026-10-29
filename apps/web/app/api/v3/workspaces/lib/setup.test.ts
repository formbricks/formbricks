import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getOrganizationWorkspacesCount, getWorkspace } from "@/lib/workspace/service";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace, updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import { createV3Workspace, updateV3Workspace } from "./setup";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@formbricks/database", () => ({ prisma: { workspace: { findFirst: vi.fn() } } }));
vi.mock("@/app/api/v3/lib/audit", () => ({ skipV3AuditLog: vi.fn() }));
vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: (authentication: { apiKeyId?: string; user?: { id: string } } | null) => {
    if (authentication?.user) return { type: "user", id: authentication.user.id };
    if (authentication?.apiKeyId) return { type: "apiKey", id: authentication.apiKeyId };
    return null;
  },
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn(), groupIdentifyPostHog: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: vi.fn(),
  getOrganizationWorkspacesCount: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getOrganizationWorkspacesLimit: vi.fn() }));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
}));

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const workspaceId = "kj4a98xxat96iws9zmbrgj3a";
const requestId = "req_1";
const instance = "/api/mcp";
const owner = { user: { id: "user_owner" }, expires: "2099-01-01" } as never;
const readKey = { apiKeyId: "key_read", organizationId, workspacePermissions: [] } as never;

const workspace = (overrides: Record<string, unknown> = {}) => ({
  id: workspaceId,
  name: "Acme",
  organizationId,
  config: { channel: null, industry: null },
  updatedAt: new Date("2026-03-01T00:00:00Z"),
  ...overrides,
});

describe("createV3Workspace", () => {
  const body = { organizationId, name: "Acme" };
  const run = (input: unknown = body, authentication: unknown = owner, auditLog?: Record<string, unknown>) =>
    createV3Workspace({
      body: input,
      authentication: authentication as never,
      requestId,
      instance,
      auditLog: auditLog as never,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as never);
    vi.mocked(getOrganization).mockResolvedValue({ id: organizationId } as never);
    vi.mocked(getOrganizationWorkspacesLimit).mockResolvedValue(3);
    vi.mocked(getOrganizationWorkspacesCount).mockResolvedValue(0);
    vi.mocked(createWorkspace).mockResolvedValue(workspace() as never);
  });

  test("creates the first workspace of an organization with none, with channel and industry", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await run({ ...body, channel: "link", industry: "saas" }, owner, auditLog);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/workspaces/${workspaceId}`);
    expect((await response.json()).data).toEqual({
      id: workspaceId,
      name: "Acme",
      organizationId,
      channel: null,
      industry: null,
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(createWorkspace).toHaveBeenCalledExactlyOnceWith(
      organizationId,
      { name: "Acme", config: { channel: "link", industry: "saas" } },
      { workspaceLimit: 3 }
    );
    expect(auditLog).toMatchObject({ organizationId, targetId: workspaceId });
  });

  test("refuses when the plan's workspace limit is reached", async () => {
    vi.mocked(getOrganizationWorkspacesCount).mockResolvedValue(3);

    const response = await run();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toMatch(/limit/);
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  test("the limit check under the organization lock is also a 403, a taken name a 409", async () => {
    vi.mocked(createWorkspace).mockRejectedValueOnce(new OperationNotAllowedError("limit"));
    expect((await run()).status).toBe(403);

    vi.mocked(createWorkspace).mockRejectedValueOnce(new InvalidInputError("exists"));
    expect((await run()).status).toBe(409);
  });

  test("a user who is not an owner or manager, and an API key, are refused", async () => {
    vi.mocked(can).mockResolvedValue(false);
    expect((await run()).status).toBe(403);

    expect((await run(body, readKey)).status).toBe(403);
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  test("a wrong organization id from a valid owner is the same 403, and validation is 400", async () => {
    vi.mocked(can).mockResolvedValue(false);
    expect((await run({ ...body, organizationId: "zz4a98xxat96iws9zmbrgj3a" })).status).toBe(403);

    for (const bad of [
      { organizationId },
      { ...body, name: " " },
      { ...body, extra: 1 },
      { ...body, channel: "sms" },
    ]) {
      expect((await run(bad)).status).toBe(400);
    }
  });
});

describe("updateV3Workspace", () => {
  const run = (input: unknown, authentication: unknown = owner, auditLog?: Record<string, unknown>) =>
    updateV3Workspace({
      workspaceId,
      body: input,
      authentication: authentication as never,
      requestId,
      instance,
      auditLog: auditLog as never,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId });
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getWorkspace).mockResolvedValue(
      workspace({ config: { channel: "link", industry: "saas", defaultSurveyLanguage: "de" } }) as never
    );
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null as never);
    vi.mocked(updateWorkspace).mockResolvedValue(
      workspace({ name: "Acme Inc", config: { channel: "app", industry: "saas" } }) as never
    );
  });

  test("writes only the named fields and merges config onto what is stored", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await run({ name: "Acme Inc", channel: "app" }, owner, auditLog);

    expect(response.status).toBe(200);
    expect(updateWorkspace).toHaveBeenCalledExactlyOnceWith(workspaceId, {
      name: "Acme Inc",
      config: { channel: "app", industry: "saas", defaultSurveyLanguage: "de" },
    });
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: workspaceId,
      oldObject: { name: "Acme" },
      newObject: { name: "Acme Inc" },
    });
  });

  test("a change that changes nothing writes and audits nothing", async () => {
    const auditLog = {};

    const response = await run({ name: "Acme", channel: "link" }, owner, auditLog);

    expect(response.status).toBe(200);
    expect(updateWorkspace).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("a name another workspace in the organization has is a 409", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({ id: "other" } as never);

    const response = await run({ name: "Taken" });

    expect(response.status).toBe(409);
    expect(updateWorkspace).not.toHaveBeenCalled();
  });

  test("needs an owner or manager; a read-only or write-only API key is refused, a manage key is not", async () => {
    vi.mocked(can).mockResolvedValue(false);
    expect((await run({ name: "Acme Inc" })).status).toBe(403);
    expect((await run({ name: "Acme Inc" }, readKey)).status).toBe(403);

    vi.mocked(can).mockImplementation(async (_actor, action) => action === "workspace.manage");
    expect((await run({ name: "Acme Inc" }, readKey)).status).toBe(200);
    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key_read" }, "workspace.manage", {
      type: "workspace",
      id: workspaceId,
    });
  });

  test("workspace read access is checked first and its refusal is relayed", async () => {
    const forbidden = new Response(null, { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(forbidden);

    expect(await run({ name: "Acme Inc" })).toBe(forbidden);
    expect(updateWorkspace).not.toHaveBeenCalled();
  });

  test("an empty update and unknown keys are 400, and the empty one names the fields to choose from", async () => {
    for (const bad of [{ name: "" }, { styling: {} }]) {
      expect((await run(bad)).status).toBe(400);
    }
    const empty = await run({});
    expect(empty.status).toBe(400);
    expect((await empty.json()).detail).toBe("Provide at least one of name, channel or industry");
    expect(updateWorkspace).not.toHaveBeenCalled();
  });

  test("clearing a field with null is a change, not an empty update", async () => {
    expect((await run({ channel: null })).status).toBe(200);
    expect(updateWorkspace).toHaveBeenCalledOnce();
  });

  test("a workspace that vanished after the access check answers the same bare 403", async () => {
    vi.mocked(getWorkspace).mockResolvedValue(null);

    const response = await run({ name: "Acme Inc" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });
});
