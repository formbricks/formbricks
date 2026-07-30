import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { createInviteToken } from "@/lib/jwt";
import { createUserAction } from "@/modules/auth/signup/actions";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { sendInviteAcceptedEmail, sendVerificationLinkEmail } from "@/modules/email";

/**
 * The reported ENG-2091 user signs in with Azure, so the account they already had is SSO-only: an
 * `identityProvider` of `azuread` and NO credential account, therefore no password to verify against.
 *
 * That matters because the duplicate detection this fix relies on reads the id Better Auth returns from
 * `signUpEmail`. The rest of the suite exercises credential accounts; this file pins the SSO-only shape,
 * which reaches `signUpEmail`'s duplicate branch by a different route (the user row exists but has no
 * `credential` account row).
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  identifyPostHogPerson: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
}));

vi.mock("@/modules/ee/mailing/lib/mailing-subscription", () => ({
  subscribeUserToMailingList: vi.fn(async () => undefined),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

const SSO_EMAIL = "azure.person@corporate-example.com";

/** An SSO-provisioned user: verified by the IdP, no credential account, so no password exists. */
const seedSsoUser = async () =>
  prisma.user.create({
    data: {
      name: "Azure Person",
      email: SSO_EMAIL,
      emailVerified: true,
      identityProvider: "azuread",
      identityProviderAccountId: "azure-object-id-123",
    },
  });

const seedInviteFor = async (email: string) => {
  const organization = await prisma.organization.create({ data: { name: "Corporate Example" } });
  const inviter = await prisma.user.create({
    data: { name: "Inviter", email: "owner@corporate-example.com" },
  });
  const invite = await prisma.invite.create({
    data: {
      email,
      organizationId: organization.id,
      creatorId: inviter.id,
      role: "member",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return {
    inviteToken: createInviteToken(invite.id, invite.email, { expiresIn: "7d" }),
    organizationId: organization.id,
  };
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("invite sign-up when the existing account is SSO-only (real Postgres)", () => {
  test("is detected as already-existing and routed to login, not to a verification email", async () => {
    const ssoUser = await seedSsoUser();
    const { inviteToken, organizationId } = await seedInviteFor(SSO_EMAIL);
    // No credential account for this user — the precondition that distinguishes this from the
    // password-account cases covered elsewhere.
    expect(await prisma.account.count({ where: { userId: ssoUser.id } })).toBe(0);
    vi.clearAllMocks();

    const result = await createUserAction({
      name: "Azure Person",
      email: SSO_EMAIL,
      password: "SomePassword1!",
      inviteToken,
    });

    // Same outcome as the credential case: told to log in, which is where the SSO buttons live.
    expect(result?.data).toEqual({ success: true, nextStep: "login_to_accept_invite" });
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();

    // Critically: no credential account may be created for an SSO-only user by an unauthenticated
    // caller — that would attach a password to an account the caller does not own.
    expect(await prisma.account.count({ where: { userId: ssoUser.id } })).toBe(0);

    // And none of the post-creation side effects touch the account.
    expect(await prisma.membership.count({ where: { organizationId, userId: ssoUser.id } })).toBe(0);
    expect(await prisma.invite.count({ where: { email: SSO_EMAIL } })).toBe(1);
    expect(sendInviteAcceptedEmail).not.toHaveBeenCalled();
    expect(subscribeUserToMailingList).not.toHaveBeenCalled();

    // The IdP-attested verification state and provider are untouched.
    const after = await prisma.user.findUnique({ where: { id: ssoUser.id } });
    expect(after?.emailVerified).toBe(true);
    expect(after?.identityProvider).toBe("azuread");
    expect(after?.password).toBeNull();
  });

  test("a plain sign-up with an SSO address creates nothing either", async () => {
    const ssoUser = await seedSsoUser();
    const orgsBefore = await prisma.organization.count();
    vi.clearAllMocks();

    const result = await createUserAction({
      name: "Impersonator",
      email: SSO_EMAIL,
      password: "AttackerPassword1!",
    });

    // Enumeration-safe: no invite, so the generic screen — identical to a brand-new address.
    expect(result?.data).toEqual({ success: true, nextStep: "verify_email" });
    expect(await prisma.account.count({ where: { userId: ssoUser.id } })).toBe(0);
    expect(await prisma.organization.count()).toBe(orgsBefore);
    expect(await prisma.membership.count({ where: { userId: ssoUser.id } })).toBe(0);
  });
});
