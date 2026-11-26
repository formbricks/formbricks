import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, test } from "vitest";
import { diagnoseOAuthStateCookie } from "./oauth-state-cookie-diagnosis";

/**
 * The contract for `diagnoseOAuthStateCookie` (ENG-6692): it re-implements better-call's signed-cookie
 * read, so the unit tests alone would keep passing if Better Auth changed how it names, signs or encodes
 * the state cookie. This drives a real Better Auth instance through a real social sign-in to mint the
 * cookie, then replays the callback in each failure shape. Every shape must be the real
 * `state_security_mismatch` throw this ticket is about, and the diagnosis must name its cause.
 *
 * `cookiePrefix` matches `auth.ts`, so the cookie name is the one production reads.
 */
const BASE_URL = "http://localhost:3000";
const SECRET = "eng-6692-contract-test-secret-0123456789abcdef";
const OTHER_REPLICA_SECRET = "eng-6692-contract-other-replica-0123456789ab";

type TMemoryDb = Parameters<typeof memoryAdapter>[0];
const createDb = (): TMemoryDb => ({ user: [], session: [], account: [], verification: [] });

const createAuth = (secret: string, seen: unknown[], db: TMemoryDb = createDb()) =>
  betterAuth({
    baseURL: BASE_URL,
    secret,
    advanced: { cookiePrefix: "formbricks" },
    database: memoryAdapter(db),
    logger: { level: "error", log: (_level, _message, ...args) => seen.push(...args) },
    socialProviders: { google: { clientId: "contract-test", clientSecret: "contract-test" } },
  });

type TAuth = ReturnType<typeof createAuth>;

/** Start a Google sign-in and return the `state` it sent to the IdP and the cookie pinning it. */
const startSignIn = async (auth: TAuth): Promise<{ state: string; cookie: string }> => {
  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ provider: "google", callbackURL: "/" }),
    })
  );
  const { url } = (await response.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  const stateCookieName = (await auth.$context).createAuthCookie("state").name;
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .find((pair) => pair.startsWith(`${stateCookieName}=`));
  if (!state || !cookie) throw new Error("the sign-in did not issue a state and a state cookie");
  return { state, cookie };
};

const callbackRequest = (state: string, cookieHeader?: string): Request =>
  new Request(`${BASE_URL}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=irrelevant`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

/** Replay a callback on `auth`; return the StateError code Better Auth threw and the diagnosis. */
const replay = async (auth: TAuth, seen: unknown[], request: Request) => {
  const context = await auth.$context;
  const diagnosis = diagnoseOAuthStateCookie(request.clone(), {
    name: context.createAuthCookie("state").name,
    secret: context.secret,
  });
  seen.length = 0;
  await auth.handler(request);
  const stateError = seen.find(
    (arg): arg is Error & { code?: unknown } => arg instanceof Error && "code" in arg
  );
  return { code: stateError?.code, message: stateError?.message, diagnosis };
};

describe("diagnoseOAuthStateCookie against a real Better Auth callback (ENG-6692 contract)", () => {
  test("the cookie Better Auth itself issued reads as matching", async () => {
    const seen: unknown[] = [];
    const auth = createAuth(SECRET, seen);
    const { state, cookie } = await startSignIn(auth);

    const context = await auth.$context;
    expect(
      diagnoseOAuthStateCookie(callbackRequest(state, cookie), {
        name: context.createAuthCookie("state").name,
        secret: context.secret,
      })
    ).toBe("matches");
  });

  test("no cookie: rejected as not persisted, diagnosed as absent", async () => {
    const seen: unknown[] = [];
    const auth = createAuth(SECRET, seen);
    const { state } = await startSignIn(auth);

    await expect(replay(auth, seen, callbackRequest(state))).resolves.toEqual({
      code: "state_security_mismatch",
      message: "State mismatch: State not persisted correctly",
      diagnosis: "absent",
    });
  });

  test("a cookie signed by a replica with another secret: diagnosed as signature_invalid", async () => {
    // Two replicas share one database but not one AUTH_SECRET: the split ENG-6692 is about. The flow
    // starts on one, so its verification record is found, and the callback lands on the other.
    const db = createDb();
    const startingReplica = createAuth(OTHER_REPLICA_SECRET, [], db);
    const seen: unknown[] = [];
    const callbackReplica = createAuth(SECRET, seen, db);
    const { state, cookie } = await startSignIn(startingReplica);

    await expect(replay(callbackReplica, seen, callbackRequest(state, cookie))).resolves.toEqual({
      code: "state_security_mismatch",
      message: "State mismatch: State not persisted correctly",
      diagnosis: "signature_invalid",
    });
  });

  test("a second sign-in overwrote the cookie: the first callback is diagnosed as state_differs", async () => {
    const seen: unknown[] = [];
    const auth = createAuth(SECRET, seen);
    const first = await startSignIn(auth);
    const second = await startSignIn(auth);

    await expect(replay(auth, seen, callbackRequest(first.state, second.cookie))).resolves.toEqual({
      code: "state_security_mismatch",
      message: "State mismatch: State not persisted correctly",
      diagnosis: "state_differs",
    });
  });
});
