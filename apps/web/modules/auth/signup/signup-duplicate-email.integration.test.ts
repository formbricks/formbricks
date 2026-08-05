import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { sendVerificationLinkEmail } from "@/modules/email";

/**
 * Pins Better Auth's duplicate-email contract, which `signUpUserSafely` depends on (ENG-2091).
 *
 * Because `emailAndPassword.requireEmailVerification || autoSignIn === false` (auth.ts sets both),
 * Better Auth answers a duplicate email with an enumeration-safe HTTP 200 carrying a SYNTHETIC user —
 * it does NOT throw. The sign-up action reads that synthetic id to tell "created" from
 * "already existed", so this contract has to be asserted against the real framework: the unit suite
 * previously mocked `signUpEmail` into rejecting, which asserted a branch that cannot execute.
 */

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const EMAIL = "invitee@corporate-example.com";
const PASSWORD = "Passw0rd!";

describe("Better Auth duplicate-email sign-up (real Postgres)", () => {
  test("a first-time sign-up persists the returned user and sends one verification email", async () => {
    const result = await auth.api.signUpEmail({
      body: { email: EMAIL, password: PASSWORD, name: "Invitee" },
    });

    const persisted = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
    // The id Better Auth returns IS the persisted row — this is the signal the action relies on.
    expect(result.user.id).toBe(persisted?.id);
    expect(sendVerificationLinkEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendVerificationLinkEmail).mock.calls[0][0].email).toBe(EMAIL);
  });

  test("a duplicate resolves with a synthetic user, sends nothing, and writes nothing", async () => {
    await auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: "Invitee" } });
    const realUser = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
    vi.clearAllMocks();

    // Deliberately NOT wrapped in expect().rejects — the whole point is that it resolves.
    const result = await auth.api.signUpEmail({
      body: { email: EMAIL, password: "TotallyDifferent1!", name: "Someone Else" },
    });

    // Synthetic: a generated id that is not in the database.
    expect(result.user.id).toBeTruthy();
    expect(result.user.id).not.toBe(realUser?.id);
    expect(await prisma.user.count({ where: { id: result.user.id } })).toBe(0);

    // No email goes out on this path, which is why the "we sent you a link" screen was a lie.
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();

    // Nothing was written: still one user, one credential account, original password still valid.
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
    expect(await prisma.account.count({ where: { userId: realUser?.id } })).toBe(1);
    const signIn = await auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      asResponse: true,
    });
    expect(signIn.status).toBe(200);
  });
});
