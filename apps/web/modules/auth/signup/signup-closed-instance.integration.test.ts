import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

/**
 * ENG-2293 at the FRAMEWORK boundary: Better Auth's native `/sign-up/email` against a real Postgres, with
 * no `createUserAction` in the way.
 *
 * ENG-2293 was reported against the raw HTTP route, where the closed-instance policy existed only in the
 * server action. Since ENG-3988 that route is closed outright (`disabledPaths`), so a raw POST now gets a
 * 404 before any hook runs. The first test pins that on a fresh instance, where the gate would have
 * admitted the sign-up, so only `disabledPaths` can make it pass.
 *
 * The policy gate (`signupPolicyBeforeHandler`) still runs on every in-process `auth.api.signUpEmail`
 * call, and it stays as defence in depth for any caller other than the action. The rest of this suite
 * drives that call, outside any action scope, so the gate is what decides it.
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

/** An unauthenticated POST to the mounted route — the request ENG-2293 was reported against. */
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

/**
 * An in-process sign-up that did NOT come through `createUserAction`, so the policy gate decides it.
 *
 * A `hooks.before` rejection reaches an `auth.api` caller as a thrown `APIError`, even with
 * `asResponse` (only the HTTP handler turns it into a response), so both outcomes are normalised to
 * the status and body a caller would see.
 */
const inProcessSignUp = async (email: string): Promise<{ status: number; body: unknown }> => {
  try {
    const response = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Someone" },
      asResponse: true,
    });
    return { status: response.status, body: await response.json() };
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    return { status: error.statusCode, body: error.body };
  }
};

const userCount = (email: string): Promise<number> => prisma.user.count({ where: { email } });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("native Better Auth sign-up on a closed instance (real Postgres)", () => {
  // Even on a fresh instance, which the gate would admit: the route is gone, not gated. The first
  // administrator signs up through the /setup form, which goes through createUserAction.
  test("the raw HTTP route is closed, even while the instance is fresh", async () => {
    expect(await prisma.user.count()).toBe(0);

    const response = await rawSignUp(ADMIN);

    expect(response.status).toBe(404);
    expect(await prisma.user.count()).toBe(0);
  });

  // The fresh-instance exception is deliberate and has to survive: with zero users there is no
  // administrator to invite anyone yet, so the first sign-up is how an instance gets set up at all.
  test("admits the first administrator while the instance is still fresh", async () => {
    expect(await prisma.user.count()).toBe(0);

    const response = await inProcessSignUp(ADMIN);

    expect(response.status).toBe(200);
    expect(await userCount(ADMIN)).toBe(1);
  });

  test("rejects an uninvited sign-up once the instance has a user", async () => {
    await inProcessSignUp(ADMIN); // consumes the fresh-instance exception
    expect(await userCount(ADMIN)).toBe(1);

    const response = await inProcessSignUp(INTRUDER);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: "signup_disabled" });
    expect(await userCount(INTRUDER)).toBe(0);
  });

  /**
   * The reason the gate runs in `hooks.before` and not only in `databaseHooks.user.create.before`.
   *
   * Better Auth looks the address up before it creates anything, and answers an address that already
   * has an account with a synthetic 200 without writing a row — so no create hook ever runs for it
   * (see signup-duplicate-email.integration.test.ts, which pins that contract). A gate placed in the
   * create hook is therefore reachable only for addresses that do NOT exist, and Better Auth turns a
   * 403 from that hook into the same synthetic 200, so the rejection would be a fake success. The gate
   * has to refuse both addresses visibly and identically, which is what this asserts: both 403, same
   * body.
   */
  test("answers a registered and an unregistered address identically", async () => {
    await inProcessSignUp(ADMIN);
    expect(await userCount(ADMIN)).toBe(1);

    const registered = await inProcessSignUp(ADMIN); // exists — would be a synthetic 200
    const unregistered = await inProcessSignUp(INTRUDER); // does not exist

    expect(registered.status).toBe(403);
    expect(registered).toStrictEqual(unregistered);
    // Still nothing written, and the existing account is untouched.
    expect(await userCount(ADMIN)).toBe(1);
    expect(await userCount(INTRUDER)).toBe(0);
  });
});
