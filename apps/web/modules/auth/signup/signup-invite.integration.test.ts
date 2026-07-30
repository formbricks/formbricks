import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { createInviteToken } from "@/lib/jwt";
import { capturePostHogEvent, identifyPostHogPerson } from "@/lib/posthog";
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

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Org + inviter + an Invite row for INVITED_EMAIL; returns the token the invite email carries.
 *
 * `expiresAt` is the row's expiry only — the JWT is always minted fresh with its own 7-day `exp`, so
 * an `expiresAt` in the past produces a structurally valid token whose invite has lapsed. That is the
 * only way to exercise the DB-side expiry check independently of the token's own.
 */
const seedInvite = async ({
  role = "member",
  expiresAt = new Date(Date.now() + WEEK_IN_MS),
}: { role?: "member" | "manager" | "owner"; expiresAt?: Date } = {}): Promise<{
  inviteToken: string;
  organizationId: string;
}> => {
  const organization = await prisma.organization.create({ data: { name: "Corporate Example" } });
  const inviter = await prisma.user.create({
    data: { name: "Inviter", email: "admin@corporate-example.com" },
  });
  const invite = await prisma.invite.create({
    data: {
      email: INVITED_EMAIL,
      organizationId: organization.id,
      creatorId: inviter.id,
      role,
      expiresAt,
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

    // ENG-2099: the response must be indistinguishable from a brand-new address — an earlier version
    // routed this case to login, which turned the invite flow into an account-existence lookup. The
    // verification-requested screen it lands on says "if there is an account associated with …" and
    // carries an unconditional log-in link, so this visitor still has a way out.
    expect(result?.data).toEqual({ success: true });
    // No verification email is sent, because no account was created.
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

  /**
   * ENG-2099: the invite sign-up response must not be usable as an account-existence lookup. Asserted
   * directly rather than inferred from the two tests above — anyone who can send an invite can run this
   * comparison, so a future change that reintroduces a differential (an extra response field, a
   * different status, or an error) has to fail here.
   *
   * Crossed with the mailer state on purpose. The first version of this fix returned a distinct
   * `verification_send_failed` step, which reads as address-independent — but Better Auth only attempts a
   * send for an address it actually created, so during a mail outage that step appeared for a fresh
   * address and never for one already taken. Comparing existence under a HEALTHY mailer, as this test
   * originally did, could never see that; the sibling `signup-verification-send` file pins the other
   * axis. Neither covers the corner on its own.
   */
  const MAILER_STATES = [
    { name: "healthy mailer", mailerReturns: true },
    { name: "mail outage", mailerReturns: false },
  ];

  test.each(MAILER_STATES)(
    "returns a byte-identical response whether or not the address exists ($name)",
    async ({ mailerReturns }) => {
      const signUp = async (seedExistingAccount: boolean) => {
        await resetDb();
        const { inviteToken } = await seedInvite();
        if (seedExistingAccount) {
          await prisma.user.create({
            data: { name: "Invitee", email: INVITED_EMAIL, password: "not-a-real-hash-fixture" },
          });
        }
        vi.mocked(sendVerificationLinkEmail).mockResolvedValue(mailerReturns);
        const result = await createUserAction({
          name: "Invitee",
          email: INVITED_EMAIL,
          password: PASSWORD,
          inviteToken,
        });
        return { data: result?.data, serverError: result?.serverError };
      };

      expect(await signUp(true)).toEqual(await signUp(false));
    }
  );

  // ENG-2071: an invite binds one address to one role in one organization. Before this, only the
  // signature was checked, so anyone holding a forwarded invite link could redeem it with an address
  // of their own and take the invited role — up to owner.
  test("refuses an invite redeemed with a different address, and creates nothing", async () => {
    const { inviteToken, organizationId } = await seedInvite(); // invite is for INVITED_EMAIL
    const attackerEmail = "attacker@other-example.com";
    vi.clearAllMocks();

    const result = await createUserAction({
      name: "Attacker",
      email: attackerEmail,
      password: "AttackerPassword1!",
      inviteToken,
    });

    // Rejected with the stable code the form maps to the generic invite copy — one code for
    // expired / revoked / wrong-address, so it can't be used to probe which invites exist.
    expect(result?.data).toBeUndefined();
    expect(result?.serverError).toContain("invite_token_invalid");

    // Nothing was written: no account for the attacker, no membership, and the invite survives for
    // its real recipient.
    expect(await prisma.user.count({ where: { email: attackerEmail } })).toBe(0);
    expect(await prisma.membership.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.invite.count({ where: { email: INVITED_EMAIL } })).toBe(1);
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();
    expect(sendInviteAcceptedEmail).not.toHaveBeenCalled();
  });

  test("refuses an expired invite even though the token signature is still valid", async () => {
    const { inviteToken, organizationId } = await seedInvite({
      role: "owner",
      expiresAt: new Date(Date.now() - 60_000), // lapsed a minute ago
    });
    vi.clearAllMocks();

    const result = await createUserAction({
      name: "Invitee",
      email: INVITED_EMAIL,
      password: PASSWORD,
      inviteToken,
    });

    expect(result?.data).toBeUndefined();
    expect(result?.serverError).toContain("invite_token_invalid");
    expect(await prisma.user.count({ where: { email: INVITED_EMAIL } })).toBe(0);
    expect(await prisma.membership.count({ where: { organizationId } })).toBe(0);
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

    // No invite, so nothing is disclosed: the response is byte-identical to a real new sign-up, and
    // the user lands on the generic "confirm your email" screen (whose copy carries a generic
    // "already have an account? log in" line). This is the enumeration-safety boundary.
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
