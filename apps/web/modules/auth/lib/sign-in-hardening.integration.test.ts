import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { POST } from "@/app/api/auth/[...all]/route";
import { flushAfter } from "@/integration/after";
import { TApiOwner, callRoute, seedOwner } from "@/integration/api-routes";
import { resetDb } from "@/integration/reset-db";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { logAuthAttempt } from "@/modules/auth/lib/utils";
import { sendVerificationLinkEmail } from "@/modules/email";

/**
 * What `POST /api/auth/sign-in/email` gives away to a caller probing it, through the real auth route
 * (body limit, Better Auth, Postgres). Moved from `playwright/api/auth/security.spec.ts` (ENG-7518); the
 * security-headers and copied-cookie tests stay there because they need the built app and a browser.
 */

const SIGN_IN = "/api/auth/sign-in/email";

// Better Auth hashes and verifies passwords through these; spied so a test can count the bcrypt work.
vi.mock("@/lib/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto")>();
  return { ...actual, hashSecret: vi.fn(actual.hashSecret), verifySecret: vi.fn(actual.verifySecret) };
});

// `auth.ts` reads this into `requireEmailVerification` at import time, and a dev `.env` sets it to `1`.
// Pinned off so an unverified account is refused here the way it is in production (ENG-2099).
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  EMAIL_VERIFICATION_DISABLED: false,
}));

// Spied so a test can read the reason the failed-sign-in audit records.
vi.mock("@/modules/auth/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/auth/lib/utils")>();
  return { ...actual, logAuthAttempt: vi.fn(actual.logAuthAttempt) };
});

// Holds `after()` work until `flushAfter()`, so a test can tell what ran before the response was sent.
vi.mock("next/server", async (importOriginal) =>
  (await import("@/integration/after")).withAfterMock(await importOriginal())
);

let owner: TApiOwner;

beforeEach(async () => {
  await resetDb();
  owner = await seedOwner();
  await flushAfter();
  vi.mocked(hashSecret).mockClear();
  vi.mocked(verifySecret).mockClear();
  vi.mocked(sendVerificationLinkEmail).mockClear();
  vi.mocked(logAuthAttempt).mockClear();
});

const postSignIn = (body: Record<string, unknown>) =>
  callRoute(POST, { method: "POST", path: SIGN_IN, body });

describe("password length", () => {
  // Better Auth's maxPasswordLength (128) rejects an over-length password before it is hashed, so a
  // long one costs no bcrypt and issues no session.
  test.each([
    ["10,000", 10_000],
    ["50,000", 50_000],
  ])("rejects a %s-character password without hashing it, and issues no session", async (_label, length) => {
    const response = await postSignIn({ email: owner.email, password: "A".repeat(length) });

    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(hashSecret).not.toHaveBeenCalled();
    expect(verifySecret).not.toHaveBeenCalled();
  });

  test("a 128-character password is not rejected for length, only as a wrong password", async () => {
    const response = await postSignIn({ email: owner.email, password: "A".repeat(128) });

    expect(response.status).toBe(401);
    // The control for the test above: a password within the limit does reach bcrypt.
    expect(verifySecret).toHaveBeenCalledTimes(1);
  });
});

describe("user enumeration", () => {
  test("an unknown email and a wrong password get the same status and the same body", async () => {
    const unknown = await postSignIn({ email: "nobody@example.com", password: "testpassword" });
    const wrongPassword = await postSignIn({ email: owner.email, password: "wrongpassword" });

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(unknown.status);
    expect(wrongPassword.body).toEqual(unknown.body);
  });

  // ENG-2099 (finishes ENG-670): every way a password sign-in can fail answers alike. A correct password on
  // an unverified account used to answer 403 EMAIL_NOT_VERIFIED, so signing up with an address and then
  // signing in told anyone whether the address was free.
  test("every credential failure, an unverified account with the right password included, answers alike", async () => {
    const userWith = async (email: string, emailVerified: boolean) =>
      await prisma.user.create({ data: { name: email, email, emailVerified, locale: "en-US" } });

    const ssoOnly = await userWith("sso-only@example.com", true);
    await prisma.account.create({
      data: { userId: ssoOnly.id, type: "oauth", provider: "google", providerAccountId: "google-sso-only" },
    });
    const noPassword = await userWith("no-password@example.com", true);
    await prisma.account.create({
      data: {
        userId: noPassword.id,
        type: "credential",
        provider: "credential",
        providerAccountId: noPassword.id,
      },
    });
    const unverified = await userWith("unverified@example.com", false);
    await prisma.account.create({
      data: {
        userId: unverified.id,
        type: "credential",
        provider: "credential",
        providerAccountId: unverified.id,
        password: await hashSecret("Unverified-Password-1", 4),
      },
    });

    const modes = {
      unknownAddress: { email: "nobody@example.com", password: "Some-Password-1" },
      noCredentialAccount: { email: "sso-only@example.com", password: "Some-Password-1" },
      credentialAccountWithoutPassword: { email: "no-password@example.com", password: "Some-Password-1" },
      wrongPassword: { email: owner.email, password: "Wrong-Password-1" },
      unverifiedWithRightPassword: { email: "unverified@example.com", password: "Unverified-Password-1" },
    };

    const answers: Record<string, { status: number; headers: [string, string][]; body: unknown }> = {};
    for (const [mode, body] of Object.entries(modes)) {
      const response = await postSignIn(body);
      expect(response.headers.getSetCookie(), mode).toEqual([]);
      answers[mode] = { status: response.status, headers: [...response.headers], body: response.body };
    }

    const expected = {
      status: 401,
      headers: answers.wrongPassword.headers,
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
    };
    expect(answers.wrongPassword.headers).toContainEqual(["content-type", "application/json"]);
    for (const [mode, answer] of Object.entries(answers)) {
      expect(answer, mode).toEqual(expected);
    }
  });

  test("the unverified account still gets a fresh verification link, sent after the response, and the audit keeps the real reason", async () => {
    const user = await prisma.user.create({
      data: { name: "Una", email: "una@example.com", emailVerified: false, locale: "en-US" },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: await hashSecret("Una-Password-1", 4),
      },
    });

    const response = await postSignIn({ email: "una@example.com", password: "Una-Password-1" });

    expect(response.status).toBe(401);
    // The caller sees a wrong password; the audit trail still says what happened.
    expect(logAuthAttempt).toHaveBeenCalledWith(
      "email_not_verified",
      "credentials",
      "password",
      expect.anything(),
      "una@example.com"
    );
    // Not on the response path: waiting on SMTP only for an unverified account made its answer
    // measurably slower than a taken address's.
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();

    await flushAfter();

    expect(sendVerificationLinkEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendVerificationLinkEmail).mock.calls[0][0]).toMatchObject({
      email: "una@example.com",
      verifyLink: expect.stringContaining("/verify-email?token="),
    });
  });

  test("an error names neither the failing factor nor the internals behind it", async () => {
    const response = await postSignIn({ email: "nobody@example.com", password: "A".repeat(10_000) });
    const text = JSON.stringify(response.body).toLowerCase();

    for (const term of [
      "bcrypt",
      "hash",
      "redis",
      "database",
      "prisma",
      "stack trace",
      "sql",
      "query",
      "connection timeout",
      "internal error",
      "user not found",
      "no user",
      "email not found",
      "incorrect password",
      "wrong password",
      "invalid password",
    ]) {
      expect(text, `the error mentions "${term}"`).not.toContain(term);
    }
  });
});

test("a body without a password is refused without a session", async () => {
  const response = await postSignIn({ email: "nobody@example.com" });

  expect(response.status).toBe(400);
  expect(response.headers.getSetCookie()).toEqual([]);
});
