import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { capturePostHogEvent, identifyPostHogPerson } from "@/lib/posthog";
import { createInviteToken } from "@/lib/jwt";
import { createUserAction } from "@/modules/auth/signup/actions";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { sendInviteAcceptedEmail, sendVerificationLinkEmail } from "@/modules/email";

/**
 * Invite sign-up at the ACTION boundary: the real `createUserAction` + real Better Auth + real
 * Postgres, driven exactly the way the sign-up form drives it (name/email/password + inviteToken).
 *
 * The second test is the ENG-2091 regression: because Better Auth answers a duplicate email with a
 * synthetic HTTP 200 instead of throwing, the action used to classify it as a fresh creation and run
 * every post-creation side effect against the pre-existing account.
 */

// The action reads/deletes the attribution cookie; there is no Next request scope under vitest.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

// Replaces the harness-wide @/modules/email mock — must keep sendVerificationLinkEmail (the Better
// Auth callback in auth.ts resolves it through this same module) and add the invite-flow senders.
vi.mock("@/modules/email", () => ({
  sendVerificationLinkEmail: vi.fn(async () => undefined),
  sendPasswordResetLinkEmail: vi.fn(async () => undefined),
  sendPasswordResetNotifyEmail: vi.fn(async () => undefined),
  sendDeleteAccountConfirmationEmail: vi.fn(async () => undefined),
  sendInviteAcceptedEmail: vi.fn(async () => undefined),
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

const INVITED_EMAIL = "invitee@corporate-example.com";
const PASSWORD = "Passw0rd!";

/** Org + inviter + a live Invite row for INVITED_EMAIL; returns the token the invite email carries. */
const seedInvite = async (): Promise<{ inviteToken: string; organizationId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Corporate Example" } });
  const inviter = await prisma.user.create({
    data: { name: "Inviter", email: "admin@corporate-example.com" },
  });
  const invite = await prisma.invite.create({
    data: {
      email: INVITED_EMAIL,
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

describe("ENG-2091: accepting an invite via sign-up", () => {
  test("brand-new invitee: verification email sent, invite accepted", async () => {
    const { inviteToken, organizationId } = await seedInvite();

    const result = await createUserAction({
      name: "Invitee",
      email: INVITED_EMAIL,
      password: PASSWORD,
      inviteToken,
    });

    expect(result?.data).toEqual({ success: true });
    expect(sendVerificationLinkEmail).toHaveBeenCalledTimes(1);

    const user = await prisma.user.findUnique({ where: { email: INVITED_EMAIL }, select: { id: true } });
    expect(await prisma.membership.count({ where: { organizationId, userId: user?.id } })).toBe(1);
    expect(await prisma.invite.count({ where: { email: INVITED_EMAIL } })).toBe(0);
  });

  test("invitee who ALREADY has an account: no side effects touch it, invite survives", async () => {
    const { inviteToken, organizationId } = await seedInvite();
    // The invitee already signed up for Formbricks earlier with the same corporate address.
    const existing = await prisma.user.create({
      data: {
        name: "Invitee",
        email: INVITED_EMAIL,
        locale: "de-DE",
        password: "not-a-real-hash-fixture",
      },
    });
    vi.clearAllMocks();

    const result = await createUserAction({
      name: "Someone Else",
      email: INVITED_EMAIL,
      password: "SomeOtherPassword1!",
      userLocale: "en-US",
      inviteToken,
    });

    // Enumeration-safe: the response is indistinguishable from a new sign-up...
    expect(result?.data).toEqual({ success: true });
    // ...and no verification email is sent, because no account was created.
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();

    // Nothing may touch the pre-existing account: this endpoint is unauthenticated and the caller has
    // proven nothing about it. The invite must survive so logging in can still accept it.
    expect(await prisma.membership.count({ where: { organizationId, userId: existing.id } })).toBe(0);
    expect(await prisma.invite.count({ where: { email: INVITED_EMAIL } })).toBe(1);
    expect(sendInviteAcceptedEmail).not.toHaveBeenCalled();
    expect(subscribeUserToMailingList).not.toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
    expect(identifyPostHogPerson).not.toHaveBeenCalled();

    // Profile fields stay untouched — name and locale are attacker-supplied on this path.
    const after = await prisma.user.findUnique({ where: { id: existing.id } });
    expect(after?.name).toBe("Invitee");
    expect(after?.locale).toBe("de-DE");
    // The existing credential is untouched (no password overwrite).
    expect(after?.password).toBe("not-a-real-hash-fixture");
  });
});

describe("plain sign-up (no invite) with an address that already exists", () => {
  test("creates no organization and no membership on the existing account", async () => {
    const existing = await prisma.user.create({
      data: { name: "Someone", email: "victim@corporate-example.com", password: "not-a-real-hash-fixture" },
    });
    const orgsBefore = await prisma.organization.count();

    const result = await createUserAction({
      name: "Attacker",
      email: "victim@corporate-example.com",
      password: "AttackerPassword1!",
    });

    expect(result?.data).toEqual({ success: true });
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();
    // On Formbricks Cloud getIsMultiOrgEnabled() is true, so before the fix this branch created an
    // organization + owner membership on someone else's account, once per request.
    expect({
      orgs: await prisma.organization.count(),
      memberships: await prisma.membership.count({ where: { userId: existing.id } }),
    }).toEqual({ orgs: orgsBefore, memberships: 0 });
    expect(subscribeUserToMailingList).not.toHaveBeenCalled();
  });
});
