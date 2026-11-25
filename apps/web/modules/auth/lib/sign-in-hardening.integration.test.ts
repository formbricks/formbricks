import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/auth/[...all]/route";
import { TApiOwner, callRoute, seedOwner } from "@/integration/api-routes";
import { resetDb } from "@/integration/reset-db";
import { hashSecret, verifySecret } from "@/lib/crypto";

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

let owner: TApiOwner;

beforeEach(async () => {
  await resetDb();
  owner = await seedOwner();
  vi.mocked(hashSecret).mockClear();
  vi.mocked(verifySecret).mockClear();
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
