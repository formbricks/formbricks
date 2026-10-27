import { generateSync } from "otplib";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import * as auditHandler from "@/modules/ee/audit-logs/lib/handler";

// Capture audit emission without running the real background audit logging (DB writes via setImmediate).
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn() };
});

/**
 * Integration coverage for two-factor auth (ENG-1054, Phase 4) against a real Postgres — drives BA's
 * twoFactor plugin (TOTP) end-to-end: enabling + verifying a secret (TwoFactor table + User.twoFactorEnabled),
 * and that an enabled second factor GATES sign-in (password alone yields a challenge, TOTP completes it).
 */
const allCookies = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

const secretFromUri = (uri: string): string => /[?&]secret=([^&]+)/.exec(uri)?.[1] ?? "";

// digits 6 / period 30 are otplib's defaults and match auth.ts totpOptions.
const totp = (secret: string): string => generateSync({ secret });

const createVerifiedUser = async (email: string, password: string): Promise<string> => {
  await auth.api.signUpEmail({ body: { email, password, name: "Tfa" }, asResponse: true });
  const user = await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  return user.id;
};

const sessionCookie = async (email: string, password: string): Promise<string> => {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  return allCookies(res);
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const signedInAudits = () =>
  vi
    .mocked(auditHandler.queueAuditEventBackground)
    .mock.calls.filter(([event]) => event.action === "signedIn");

/**
 * Better Auth 1.7 types `enableTwoFactor`'s response as a union on `method` — `{ method: "otp" }` carries
 * no `totpURI` at all — so destructuring it directly no longer typechecks (surfaced once test files
 * entered the typecheck graph, #8890).
 *
 * Narrowed rather than cast, deliberately: our config enrols TOTP, and if a future version ever answers
 * `otp` here this fails with a legible message instead of feeding `undefined` into `secretFromUri` and
 * failing several lines later as an unreadable TOTP error.
 */
const enrolTotp = async (cookie: string): Promise<string> => {
  const enrolled = await auth.api.enableTwoFactor({
    body: { password: "Passw0rd!" },
    headers: { cookie },
  });
  if (enrolled.method !== "totp") {
    throw new Error(`expected a TOTP enrolment, got method="${enrolled.method}"`);
  }
  return enrolled.totpURI;
};

describe("Better Auth two-factor (real Postgres)", () => {
  test("enabling 2FA + verifying a TOTP flips twoFactorEnabled and stores the secret", async () => {
    const userId = await createVerifiedUser("tfa@example.com", "Passw0rd!");
    const cookie = await sessionCookie("tfa@example.com", "Passw0rd!");

    const totpURI = await enrolTotp(cookie);
    expect(totpURI).toContain("otpauth://");

    await auth.api.verifyTOTP({ body: { code: totp(secretFromUri(totpURI)) }, headers: { cookie } });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { twoFactor: true } });
    expect(user?.twoFactorEnabled).toBe(true);
    expect(user?.twoFactor).not.toBeNull(); // one TwoFactor row per user (one-to-one, @@unique(userId))
  });

  test("an enabled second factor gates sign-in: password yields a challenge, TOTP issues the session", async () => {
    await createVerifiedUser("login2fa@example.com", "Passw0rd!");
    const enrollCookie = await sessionCookie("login2fa@example.com", "Passw0rd!");
    const totpURI = await enrolTotp(enrollCookie);
    const secret = secretFromUri(totpURI);
    await auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: { cookie: enrollCookie } });
    await prisma.session.deleteMany(); // clear the enrollment session
    // ...and the activity it recorded, so the sign-in below starts from none.
    await prisma.user.update({ where: { email: "login2fa@example.com" }, data: { lastActiveAt: null } });
    const lastActiveAt = async () =>
      (await prisma.user.findUniqueOrThrow({ where: { email: "login2fa@example.com" } })).lastActiveAt;

    // password-only sign-in returns a 2FA challenge (a 200, not an error) — but no full session yet,
    // and no activity: the data retention members clock must not count a password alone (ENG-3612)
    const challenge = await auth.api.signInEmail({
      body: { email: "login2fa@example.com", password: "Passw0rd!" },
      asResponse: true,
    });
    expect(challenge.status).toBe(200);
    expect(await prisma.session.count()).toBe(0);
    expect(await lastActiveAt()).toBeNull();

    // completing the TOTP challenge issues the session, and records the activity
    await auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: { cookie: allCookies(challenge) } });
    expect(await prisma.session.count()).toBe(1);
    expect(Date.now() - (await lastActiveAt())!.getTime()).toBeLessThan(60_000);
  });

  test("turning 2FA on is not a sign-in", async () => {
    const userId = await createVerifiedUser("enrol2fa@example.com", "Passw0rd!");
    const cookie = await sessionCookie("enrol2fa@example.com", "Passw0rd!");
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: null } });
    vi.clearAllMocks();

    // Verifying the first code swaps the signed-in session for a new one; nobody signed in.
    const secret = secretFromUri(await enrolTotp(cookie));
    await auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: { cookie } });

    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(true);
    expect(signedInAudits()).toHaveLength(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).lastLoginAt).toBeNull();
  });

  test("a sign-in is recorded once, when the second factor completes it, not at the password step", async () => {
    const userId = await createVerifiedUser("audit2fa@example.com", "Passw0rd!");
    const enrollCookie = await sessionCookie("audit2fa@example.com", "Passw0rd!");
    const secret = secretFromUri(await enrolTotp(enrollCookie));
    await auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: { cookie: enrollCookie } });
    await prisma.session.deleteMany();
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: null } });
    vi.clearAllMocks();

    // The password alone: a challenge, no sign-in. Nothing in the audit trail or on the user says otherwise.
    const challenge = await auth.api.signInEmail({
      body: { email: "audit2fa@example.com", password: "Passw0rd!" },
      asResponse: true,
    });
    expect(challenge.status).toBe(200);
    expect(signedInAudits()).toHaveLength(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).lastLoginAt).toBeNull();

    // The second factor completes it: one signedIn event, and the sign-in time.
    await auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: { cookie: allCookies(challenge) } });
    expect(signedInAudits()).toEqual([
      [
        expect.objectContaining({
          status: "success",
          userId,
          targetId: userId,
          newObject: { authMethod: "password", sessionStrategy: "database" },
        }),
      ],
    ]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).lastLoginAt).not.toBeNull();
  });
});
