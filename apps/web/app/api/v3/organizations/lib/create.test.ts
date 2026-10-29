import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, getEmailDomain, groupIdentifyPostHog } from "@/lib/posthog";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import {
  MULTI_ORG_DISABLED_MESSAGE,
  ORGANIZATION_CREATE_SIGNED_IN_MESSAGE,
  createV3Organization,
} from "./create";
import { getOrganizationCreationPolicy } from "./creation-policy";
import { ZV3OrganizationCreatedResource } from "./schemas";

const constants = vi.hoisted(() => ({ IS_FORMBRICKS_CLOUD: false }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { organization: { delete: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_FORMBRICKS_CLOUD() {
    return constants.IS_FORMBRICKS_CLOUD;
  },
}));
vi.mock("@/lib/membership/service", () => ({ createMembership: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ createOrganization: vi.fn() }));
vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
  getEmailDomain: vi.fn(() => "example.com"),
}));
vi.mock("@/modules/agent-setup/urls", () => ({
  getSetupGuideUrl: vi.fn(() => "https://app.example.com/agents/setup.md"),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn(),
}));
vi.mock("./creation-policy", () => ({ getOrganizationCreationPolicy: vi.fn() }));

const requestId = "req_1";
const instance = "/api/mcp";
const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const person = {
  user: { id: "user_1", name: "Olivia", email: "olivia@example.com" },
  expires: "2099-01-01",
} as never;
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
    constants.IS_FORMBRICKS_CLOUD = false;
    policy();
    vi.mocked(createOrganization).mockResolvedValue({ id: organizationId, name: "Acme" } as never);
    vi.mocked(createMembership).mockResolvedValue({} as never);
    vi.mocked(ensureCloudStripeSetupForOrganization).mockResolvedValue(undefined as never);
  });

  test("creates the organization, makes the caller its owner and answers 201 with the guide pointer", async () => {
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
    // The name is trimmed by the body schema before it reaches the service.
    expect(createOrganization).toHaveBeenCalledExactlyOnceWith({ name: "Acme" });
    expect(createMembership).toHaveBeenCalledExactlyOnceWith(organizationId, "user_1", {
      role: "owner",
      accepted: true,
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
    expect(createOrganization).not.toHaveBeenCalled();
  });

  test("no authentication is 401", async () => {
    const response = await run({ name: "Acme" }, null);

    expect(response.status).toBe(401);
    expect(createOrganization).not.toHaveBeenCalled();
  });

  test("a session without a user id is not a signed-in person", async () => {
    const response = await run({ name: "Acme" }, { user: {}, expires: "2099-01-01" });

    expect(response.status).toBe(403);
    expect(createOrganization).not.toHaveBeenCalled();
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
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createMembership).not.toHaveBeenCalled();
  });

  test("with multi-organization off and organizations already present, 403 with the licence message", async () => {
    policy({ allowed: false, hasNoOrganizations: false, isMultiOrgEnabled: false });

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(MULTI_ORG_DISABLED_MESSAGE);
    expect(applyRateLimit).not.toHaveBeenCalled();
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createMembership).not.toHaveBeenCalled();
  });

  test("on a fresh instance the first organization is allowed without the licence and flagged as the first", async () => {
    policy({ allowed: true, hasNoOrganizations: true, isMultiOrgEnabled: false });

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(201);
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "organization_created",
      { organization_id: organizationId, is_first_org: true },
      { organizationId }
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
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createMembership).not.toHaveBeenCalled();
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

  test("Stripe is set up only on Cloud, and only after the membership exists", async () => {
    await run({ name: "Acme" });
    expect(ensureCloudStripeSetupForOrganization).not.toHaveBeenCalled();

    constants.IS_FORMBRICKS_CLOUD = true;
    await run({ name: "Acme" });

    expect(ensureCloudStripeSetupForOrganization).toHaveBeenCalledExactlyOnceWith(organizationId);
    const [membershipOrder] = vi.mocked(createMembership).mock.invocationCallOrder.slice(-1);
    const [stripeOrder] = vi.mocked(ensureCloudStripeSetupForOrganization).mock.invocationCallOrder;
    expect(membershipOrder).toBeLessThan(stripeOrder);
  });

  test("a failing Stripe setup does not fail the request", async () => {
    constants.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(ensureCloudStripeSetupForOrganization).mockRejectedValue(new Error("stripe down"));

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(201);
  });

  test("identifies the organization group in analytics", async () => {
    await run({ name: "Acme" });

    expect(groupIdentifyPostHog).toHaveBeenCalledWith("organization", organizationId, {
      name: "Acme",
      email_domain: "example.com",
    });
  });

  test("a session without an email still creates the organization (analytics must not fail the request)", async () => {
    vi.mocked(getEmailDomain).mockImplementation(((email: string) => email.split("@")[1]) as never);

    const response = await run({ name: "Acme" }, { user: { id: "user_1" }, expires: "2099-01-01" });

    expect(response.status).toBe(201);
    expect(groupIdentifyPostHog).toHaveBeenCalledWith("organization", organizationId, {
      name: "Acme",
      email_domain: undefined,
    });
  });

  test("an unexpected failure while creating answers a problem response instead of throwing", async () => {
    vi.mocked(createOrganization).mockRejectedValue(new Error("database down"));

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(500);
    expect(createMembership).not.toHaveBeenCalled();
  });
  test("removes the organization again when the owner membership cannot be written, and answers 500", async () => {
    vi.mocked(createMembership).mockRejectedValue(new Error("database unavailable"));
    vi.mocked(prisma.organization.delete).mockResolvedValue({} as never);

    const response = await run({ name: "Acme" });

    expect(response.status).toBe(500);
    expect(prisma.organization.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: organizationId } });
    expect(ensureCloudStripeSetupForOrganization).not.toHaveBeenCalled();
  });
});
