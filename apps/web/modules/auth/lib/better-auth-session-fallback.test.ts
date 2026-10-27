import { REDIS_ERROR, createSecondaryStorageMock } from "./__mocks__/secondary-storage.mock";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, test, vi } from "vitest";

const BASE_URL = "https://app.formbricks.test";

const createAuthInstance = (
  storeSessionInDatabase: boolean,
  preserveSessionInDatabase = false,
  session: BetterAuthOptions["session"] = {}
) => {
  const secondaryStorage = createSecondaryStorageMock();
  const log = vi.fn();
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: "better-auth-session-fallback-test-secret",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    secondaryStorage: secondaryStorage.storage,
    session: { ...session, storeSessionInDatabase, preserveSessionInDatabase },
    logger: { level: "error", log },
  });

  const signUp = async (): Promise<string> => {
    const response = await auth.api.signUpEmail({
      body: { email: "redis-fallback@example.com", password: "Correct-Horse1", name: "Redis Fallback" },
      asResponse: true,
    });
    expect(response.status).toBe(200);

    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  };

  return { auth, db, secondaryStorage, log, signUp };
};

describe("Better Auth session database fallback", () => {
  test("returns the database-backed session when secondary storage throws", async () => {
    const { auth, secondaryStorage, log, signUp } = createAuthInstance(true);
    const cookie = await signUp();
    secondaryStorage.failReads();

    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).resolves.toMatchObject({
      user: { email: "redis-fallback@example.com" },
    });
    expect(log).toHaveBeenCalledWith(
      "error",
      "Failed to read session from secondary storage; falling back to database",
      REDIS_ERROR
    );
  });

  test("propagates the secondary-storage error when sessions are not stored in the database", async () => {
    const { auth, secondaryStorage, signUp } = createAuthInstance(false);
    const cookie = await signUp();
    secondaryStorage.failReads();

    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).rejects.toMatchObject({
      status: "INTERNAL_SERVER_ERROR",
      body: { code: "FAILED_TO_GET_SESSION" },
    });
  });

  test("propagates the secondary-storage error when database sessions are preserved", async () => {
    const { auth, secondaryStorage, signUp } = createAuthInstance(true, true);
    const cookie = await signUp();
    secondaryStorage.failReads();

    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).rejects.toMatchObject({
      status: "INTERNAL_SERVER_ERROR",
      body: { code: "FAILED_TO_GET_SESSION" },
    });
  });
});

// ENG-3418: what Better Auth does with a session whose Postgres row is gone while Redis still holds it.
// `getSession` in session.ts depends on both answers — it rejects the served session by checking the
// row, and catches the 401 by its exact status and code — so a version bump that changes either must
// fail here rather than silently reopening the crash.
describe("Better Auth session whose database row is gone", () => {
  // `updateAge: 0` makes every read take the refresh branch, which in production is entered once a day.
  const REFRESH_EVERY_READ = { expiresIn: 60 * 60, updateAge: 0 };

  test("is still served from secondary storage when no refresh is due", async () => {
    const { auth, db, signUp } = createAuthInstance(true);
    const cookie = await signUp();
    db.session = [];

    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).resolves.toMatchObject({
      user: { email: "redis-fallback@example.com" },
    });
  });

  test("throws UNAUTHORIZED / FAILED_TO_GET_SESSION when a refresh is due", async () => {
    const { auth, db, signUp } = createAuthInstance(true, false, REFRESH_EVERY_READ);
    const cookie = await signUp();
    db.session = [];

    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).rejects.toMatchObject({
      status: "UNAUTHORIZED",
      body: { code: "FAILED_TO_GET_SESSION" },
    });
  });

  test("resolves to null when secondary storage has lost it too", async () => {
    const { auth, db, secondaryStorage, signUp } = createAuthInstance(true, false, REFRESH_EVERY_READ);
    const cookie = await signUp();
    db.session = [];
    secondaryStorage.clear();

    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).resolves.toBeNull();
  });
});
