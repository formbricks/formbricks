import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE } from "@/modules/account/constants";
import { auth } from "@/modules/auth/lib/auth";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

// getIsMultiOrgEnabled is an external license input to the deletion guard (not the behavior under
// test), so we mock just that one export and drive it per-test (default single-org, set in
// beforeEach); the rest of the license-check module stays real.
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getIsMultiOrgEnabled: vi.fn() };
});

/**
 * Integration coverage for account deletion (ENG-1054, design doc §14) against a real Postgres —
 * drives Better Auth's native deleteUser through the user.deleteUser config
 * (better-auth-account-deletion.ts): the sole-owner-org block (beforeDelete) and the real Prisma
 * cascade (User → Account / Session / Membership) that replaces deleteUserById.
 */
const signInCookie = async (email: string, password: string): Promise<string> => {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  const cookies = res.headers.getSetCookie();
  const session = cookies.find((c) => c.includes("session_token"));
  if (!session) throw new Error(`no session cookie in sign-in response (got: ${cookies.join(", ")})`);
  return session.split(";")[0]; // name=value, dropping attributes
};

const createVerifiedUser = async (email: string, password: string): Promise<string> => {
  await auth.api.signUpEmail({ body: { email, password, name: "Del" }, asResponse: true });
  const user = await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  return user.id;
};

beforeEach(async () => {
  await resetDb();
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false); // single-org by default
});

describe("Better Auth account deletion (real Postgres)", () => {
  test("blocks deletion when the user is the sole owner of an org on a single-org instance", async () => {
    const userId = await createVerifiedUser("owner@example.com", "Passw0rd!");
    const org = await prisma.organization.create({ data: { name: "Solo Org" } });
    await prisma.membership.create({
      data: { userId, organizationId: org.id, role: "owner", accepted: true },
    });
    const cookie = await signInCookie("owner@example.com", "Passw0rd!");

    await expect(
      auth.api.deleteUser({ body: { password: "Passw0rd!" }, headers: { cookie } })
    ).rejects.toThrow(ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE);

    // both the user and the org survive the blocked deletion
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
  });

  test("deletes the user and cascades its account, session, and membership rows", async () => {
    const userId = await createVerifiedUser("gone@example.com", "Passw0rd!");
    // a non-owner membership: the user isn't a sole owner, so deletion proceeds and the row cascades
    const org = await prisma.organization.create({ data: { name: "Shared Org" } });
    await prisma.membership.create({
      data: { userId, organizationId: org.id, role: "member", accepted: true },
    });
    const cookie = await signInCookie("gone@example.com", "Passw0rd!");
    expect(await prisma.session.count()).toBe(1);
    expect(await prisma.account.count()).toBe(1);

    await auth.api.deleteUser({ body: { password: "Passw0rd!" }, headers: { cookie } });

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.account.count()).toBe(0); // Prisma cascade
    expect(await prisma.session.count()).toBe(0); // Prisma cascade
    expect(await prisma.membership.count()).toBe(0); // Prisma cascade
    // the org survives (the user wasn't its sole owner)
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
  });

  test("multi-org: deletes the user's sole-owned orgs instead of blocking", async () => {
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    const userId = await createVerifiedUser("multiowner@example.com", "Passw0rd!");
    const org = await prisma.organization.create({ data: { name: "Owned Org" } });
    await prisma.membership.create({
      data: { userId, organizationId: org.id, role: "owner", accepted: true },
    });
    const cookie = await signInCookie("multiowner@example.com", "Passw0rd!");

    await auth.api.deleteUser({ body: { password: "Passw0rd!" }, headers: { cookie } });

    // no block on a multi-org instance: the user is gone AND the sole-owned org was deleted (cascade)
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).toBeNull();
  });

  test("rejects an empty-body delete from a fresh session (no password, no token)", async () => {
    const userId = await createVerifiedUser("freshnoconfirm@example.com", "Passw0rd!");
    const cookie = await signInCookie("freshnoconfirm@example.com", "Passw0rd!");

    // The just-issued session is younger than freshAge, so Better Auth's native flow would skip the
    // (absent) password check and delete via the freshness shortcut. The
    // requireDeletionConfirmationBeforeHandler before-hook must reject the password-less POST so the
    // account survives.
    await expect(auth.api.deleteUser({ body: {}, headers: { cookie } })).rejects.toThrow(
      /password confirmation/i
    );

    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    expect(await prisma.session.count()).toBe(1); // session not revoked either
  });

  test("SSO email-link path: a delete-account token + session deletes the user without a password", async () => {
    const userId = await createVerifiedUser("ssodelete@example.com", "Passw0rd!");
    const cookie = await signInCookie("ssodelete@example.com", "Passw0rd!");

    // what the SSO request-deletion action does (design §14): mint a `delete-account-<token>`
    // verification value carrying the user id; the global sendDeleteAccountVerification stays OFF.
    const token = `tok-${userId}`;
    const ctx = await auth.$context;
    await ctx.internalAdapter.createVerificationValue({
      identifier: `delete-account-${token}`,
      value: userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // BA's native GET /delete-user/callback consumes the token (value === session.user.id) and deletes
    await auth.api.deleteUserCallback({
      query: { token, callbackURL: "/" },
      headers: { cookie },
      asResponse: true,
    });

    // deleted via the email-link path — no password supplied (the SSO half of §14)
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });

  test("blocks a password-less POST /delete-user, closing Better Auth's freshAge bypass (S1)", async () => {
    const userId = await createVerifiedUser("noconfirm@example.com", "Passw0rd!");
    const cookie = await signInCookie("noconfirm@example.com", "Passw0rd!");

    // No password and no token. Better Auth would otherwise permit this on a fresh session (freshAge),
    // but the hooks.before guard requires an explicit confirmation factor on the POST entry point.
    await expect(auth.api.deleteUser({ body: {}, headers: { cookie } })).rejects.toThrow(
      "Password confirmation is required"
    );
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
  });
});
