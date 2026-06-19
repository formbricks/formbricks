import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "@/modules/ee/sso/lib/sso-provisioning";

/**
 * Integration coverage for the SSO just-in-time provisioning LOGIC against a real Postgres (ENG-1054,
 * design doc §13). The full OAuth round-trip is a cutover validation with real IdPs (the genericOAuth
 * providers aren't even registered without ENTERPRISE_LICENSE_KEY + provider env, and the callback
 * needs real IdP token/userinfo endpoints — runbook §4). What IS testable now is the provider-agnostic
 * provisioning: the gate's decision against real instance state, and the membership / notification-
 * settings WRITES the unit tests can only mock.
 *
 * Best-effort CRM/analytics sync is mocked — this is a DB-boundary test, not a network test.
 */
vi.mock("@/modules/auth/lib/brevo", () => ({
  createBrevoCustomer: vi.fn(),
  deleteBrevoCustomerByEmail: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));

const createUser = async (email: string): Promise<string> => {
  await auth.api.signUpEmail({ body: { email, password: "Passw0rd!", name: "Sso" }, asResponse: true });
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
};

beforeEach(async () => {
  await resetDb();
});

describe("SSO provisioning (real Postgres)", () => {
  test("gate: a fresh/empty instance provisions with no org auto-assignment", async () => {
    const decision = await gateSsoProvisioning({ email: "first@example.com", callbackUrl: "" });
    expect(decision).toEqual({
      action: "provision",
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });

  test("writes: assigns the user to the org as an accepted member + records it in notification settings", async () => {
    const userId = await createUser("sso@example.com");
    const org = await prisma.organization.create({ data: { name: "SSO Org" } });

    await provisionSsoUserMemberships({
      userId,
      email: "sso@example.com",
      provider: "google",
      organizationId: org.id,
      assignToDefaultTeam: false,
      signupSource: "direct",
    });

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: org.id } },
    });
    expect(membership?.role).toBe("member");
    expect(membership?.accepted).toBe(true);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationSettings: true },
    });
    const settings = (user?.notificationSettings ?? {}) as { unsubscribedOrganizationIds?: string[] };
    expect(settings.unsubscribedOrganizationIds).toContain(org.id);
  });

  test("writes are idempotent: provisioning twice keeps a single membership and never throws", async () => {
    const userId = await createUser("sso2@example.com");
    const org = await prisma.organization.create({ data: { name: "SSO Org 2" } });
    const args = {
      userId,
      email: "sso2@example.com",
      provider: "google" as const,
      organizationId: org.id,
      assignToDefaultTeam: false,
      signupSource: "direct" as const,
    };

    await provisionSsoUserMemberships(args);
    await provisionSsoUserMemberships(args);

    expect(await prisma.membership.count({ where: { userId, organizationId: org.id } })).toBe(1);
  });
});
