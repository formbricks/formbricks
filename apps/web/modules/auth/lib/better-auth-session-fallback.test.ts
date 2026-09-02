import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, test, vi } from "vitest";

const BASE_URL = "https://app.formbricks.test";
const REDIS_ERROR = new Error("Socket closed unexpectedly");

const createSecondaryStorage = () => {
  const values = new Map<string, string>();
  let failReads = false;

  return {
    storage: {
      get: vi.fn(async (key: string) => {
        if (failReads) throw REDIS_ERROR;
        return values.get(key) ?? null;
      }),
      set: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    } satisfies BetterAuthOptions["secondaryStorage"],
    failReads: () => {
      failReads = true;
    },
  };
};

const createAuthInstance = (storeSessionInDatabase: boolean) => {
  const secondaryStorage = createSecondaryStorage();
  const log = vi.fn();
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: "better-auth-session-fallback-test-secret",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    secondaryStorage: secondaryStorage.storage,
    session: { storeSessionInDatabase },
    logger: { level: "error", log },
  });

  return { auth, secondaryStorage, log };
};

const signUp = async (auth: ReturnType<typeof betterAuth>): Promise<string> => {
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

describe("Better Auth session database fallback", () => {
  test("returns the database-backed session when secondary storage throws", async () => {
    const { auth, secondaryStorage, log } = createAuthInstance(true);
    const cookie = await signUp(auth);
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
    const { auth, secondaryStorage } = createAuthInstance(false);
    const cookie = await signUp(auth);
    secondaryStorage.failReads();

    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).rejects.toMatchObject({
      status: "INTERNAL_SERVER_ERROR",
      body: { code: "FAILED_TO_GET_SESSION" },
    });
  });
});
