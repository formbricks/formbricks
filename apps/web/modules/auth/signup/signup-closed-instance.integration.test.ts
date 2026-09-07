import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

/**
 * ENG-2293 at the FRAMEWORK boundary: Better Auth's native `POST /sign-up/email` against a real
 * Postgres, with no `createUserAction` in the way.
 *
 * This is the boundary the vulnerability lived at, so it is the boundary the regression test has to
 * drive. `app/api/auth/[...all]/route.ts` mounts `auth.handler` raw, which serves Better Auth's own
 * credential sign-up route beside ours; the closed-instance policy used to exist only in the server
 * action, so an unauthenticated POST created an account on an instance the operator had closed. A unit
 * test that calls the hook directly cannot show any of that — it asserts our function, not that the
 * route is actually gated or that the caller gets a 403.
 *
 * Driven through `auth.handler` with a real `Request` — the same call `app/api/auth/[...all]/route.ts`
 * makes, wrapped the same way — rather than `auth.api.signUpEmail`. That is not stylistic: an `APIError`
 * thrown from a `hooks.before` middleware propagates to an `auth.api` caller as a rejected promise, and
 * only the HTTP handler turns it into the 403 an attacker would actually receive. Asserting the status
 * code is the whole point here, so the test has to go through the layer that produces one.
 */

/**
 * A CLOSED self-hosted instance. `SIGNUP_ENABLED` is derived
 * (`IS_FORMBRICKS_CLOUD || IS_DEVELOPMENT || E2E_TESTING`) and so is already false under vitest, but
 * pin it: this suite is meaningless if an env change quietly opens sign-up, and a passing test would
 * then prove nothing. Multi-org is forced off for the same reason — with it on, public sign-up counts
 * as open and every assertion below would invert.
 */
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  SIGNUP_ENABLED: false,
}));

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsMultiOrgEnabled: vi.fn(async () => false),
}));

const PASSWORD = "Passw0rd!";
const ADMIN = "admin@corporate-example.com";
const INTRUDER = "intruder@corporate-example.com";

const SIGNUP_URL = "http://localhost:3000/api/auth/sign-up/email";

/** An unauthenticated POST to the mounted route — the request the vulnerability was reported against. */
const rawSignUp = (email: string): Promise<Response> =>
  runWithSsoRequestContext(() =>
    auth.handler(
      new Request(SIGNUP_URL, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password: PASSWORD, name: "Someone" }),
      })
    )
  );

const userCount = (email: string): Promise<number> => prisma.user.count({ where: { email } });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("raw Better Auth sign-up on a closed instance (real Postgres)", () => {
  // The fresh-instance exception is deliberate and has to survive the fix: with zero users there is no
  // administrator to invite anyone yet, so the first sign-up is how an instance gets set up at all.
  test("admits the first administrator while the instance is still fresh", async () => {
    expect(await prisma.user.count()).toBe(0);

    const response = await rawSignUp(ADMIN);

    expect(response.status).toBe(200);
    expect(await userCount(ADMIN)).toBe(1);
  });

  test("rejects an uninvited sign-up once the instance has a user", async () => {
    await rawSignUp(ADMIN); // consumes the fresh-instance exception
    expect(await userCount(ADMIN)).toBe(1);

    const response = await rawSignUp(INTRUDER);

    // Before the fix this returned 200 and created the account.
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "signup_disabled" });
    expect(await userCount(INTRUDER)).toBe(0);
  });

  /**
   * The reason the gate runs in `hooks.before` and not only in `databaseHooks.user.create.before`.
   *
   * Better Auth looks the address up before it creates anything, and answers an address that already
   * has an account with a synthetic 200 without writing a row — so no create hook ever runs for it
   * (see signup-duplicate-email.integration.test.ts, which pins that contract). A gate placed in the
   * create hook is therefore reachable only for addresses that do NOT exist, and its rejection becomes
   * an account-existence oracle: 403 for an unregistered address, 200 for a registered one. `autoSignIn:
   * false` makes that branch unconditional and auth.ts calls it "enumeration-safe", so this test exists
   * to keep it that way.
   */
  test("answers a registered and an unregistered address identically", async () => {
    await rawSignUp(ADMIN);
    expect(await userCount(ADMIN)).toBe(1);

    const registered = await rawSignUp(ADMIN); // exists — would be a synthetic 200
    const unregistered = await rawSignUp(INTRUDER); // does not exist

    expect(registered.status).toBe(unregistered.status);
    expect(await registered.json()).toStrictEqual(await unregistered.json());
    // Still nothing written, and the existing account is untouched.
    expect(await userCount(ADMIN)).toBe(1);
    expect(await userCount(INTRUDER)).toBe(0);
  });
});
