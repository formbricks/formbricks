import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { settleSignInBudgetAfterHandler, signInBudgetBeforeHandler } from "./better-auth-sign-in-budget";

vi.mock("server-only", () => ({}));

/**
 * An in-memory stand-in for the Redis reserve/settle pair: `spent` counts units reserved and not given back,
 * per identifier. Everything else (the hook wiring, `ctx.context` across the before and after hooks, what
 * Better Auth leaves in `returned`) is the real Better Auth, so this proves the assumptions the hook makes.
 */
const budget = vi.hoisted(() => {
  const spent = new Map<string, number>();
  return {
    spent,
    total: () => [...spent.values()].reduce((sum, units) => sum + units, 0),
    reserve: async (_config: unknown, identifier: string) => {
      spent.set(identifier, (spent.get(identifier) ?? 0) + 1);
      return { identifier };
    },
    settle: async (reservation: { identifier: string } | undefined, successful: number) => {
      if (!reservation || successful !== 0) return;
      spent.set(reservation.identifier, (spent.get(reservation.identifier) ?? 0) - 1);
    },
  };
});

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  reserveRateLimitUsage: budget.reserve,
  settleRateLimitUsage: budget.settle,
}));

const EMAIL = "user@example.com";
const PASSWORD = "correct-horse-battery-1";
const ORIGIN = "http://localhost:3000";

const makeAuth = () =>
  betterAuth({
    baseURL: ORIGIN,
    secret: "x".repeat(40),
    database: memoryAdapter({ user: [], session: [], account: [], verification: [], twoFactor: [] }),
    emailAndPassword: { enabled: true },
    // twoFactor() as in auth.ts: its after hook turns a correct password into a pending 2FA challenge.
    plugins: [twoFactor({ skipVerificationOnEnable: true })],
    // Wired the way auth.ts wires them: the before hook first, the settle in the root after chain.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        await signInBudgetBeforeHandler(ctx);
      }),
      after: createAuthMiddleware(async (ctx) => {
        await settleSignInBudgetAfterHandler(ctx);
      }),
    },
  });

type TAuth = ReturnType<typeof makeAuth>;

const cookieHeader = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((cookie) => !cookie.endsWith("="))
    .join("; ");

/** Signs up and returns the session cookie jar. Sign-up never touches the sign-in budget. */
const signUp = async (auth: TAuth) => {
  const result = await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: "U" },
    returnHeaders: true,
  });
  return new Headers({ cookie: cookieHeader(result.headers) });
};

/** A password sign-in over the HTTP router, the way the login form sends it. */
const signInOverHttp = (auth: TAuth, password: string, email = EMAIL) =>
  auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    })
  );

describe("sign-in failure budget (SEC-18) against a real Better Auth instance", () => {
  beforeEach(() => {
    budget.spent.clear();
  });

  test("a correct password gives the unit back", async () => {
    const auth = makeAuth();
    await signUp(auth);

    const response = await signInOverHttp(auth, PASSWORD);

    expect(response.status).toBe(200);
    expect(budget.total()).toBe(0);
  });

  test("a wrong password keeps the unit, and each wrong guess spends one more", async () => {
    const auth = makeAuth();
    await signUp(auth);

    const first = await signInOverHttp(auth, "wrong-password-1");
    const second = await signInOverHttp(auth, "wrong-password-2");

    expect(first.status).toBe(401);
    expect(((await first.json()) as { code?: string }).code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(second.status).toBe(401);
    expect(budget.total()).toBe(2);
  });

  test("an unknown address spends a unit exactly like a wrong password on a real account", async () => {
    const auth = makeAuth();

    const response = await signInOverHttp(auth, PASSWORD, "nobody@example.com");

    expect(response.status).toBe(401);
    expect(budget.total()).toBe(1);
  });

  test("a correct password on a 2FA account gives the unit back; the challenge has its own lockout", async () => {
    const auth = makeAuth();
    const headers = await signUp(auth);
    await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });

    const response = await signInOverHttp(auth, PASSWORD);

    expect(response.status).toBe(200);
    expect(((await response.json()) as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
    expect(budget.total()).toBe(0);
  });

  test("a wrong password on a 2FA account keeps the unit", async () => {
    const auth = makeAuth();
    const headers = await signUp(auth);
    await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });

    const response = await signInOverHttp(auth, "wrong-password-1");

    expect(response.status).toBe(401);
    expect(budget.total()).toBe(1);
  });

  test("an in-process auth.api call settles the same way as the HTTP router", async () => {
    const auth = makeAuth();
    await signUp(auth);

    await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } });
    expect(budget.total()).toBe(0);

    await expect(
      auth.api.signInEmail({ body: { email: EMAIL, password: "wrong-password-1" } })
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(budget.total()).toBe(1);
  });
});
