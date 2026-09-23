import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Resolution of the BETTER_AUTH_* / NEXTAUTH_* alias, which every auth consumer now reads through
 * `AUTH_SECRET` / `AUTH_URL` / `AUTH_TRUSTED_ORIGINS` instead of re-deriving.
 *
 * This is the only place the precedence is asserted. The consumers (session-cookie.ts, pin-token.ts,
 * oauth-urls.ts, jwt.ts, …) mock the resolved constant, so a precedence test over there would only
 * prove the mock agrees with itself.
 */
const ORIGINAL_ENV = process.env;

const BETTER_AUTH_SECRET = "better-auth-secret-at-least-32-chars!";
const NEXTAUTH_SECRET = "nextauth-secret-at-least-32-characters";

const setTestEnv = (overrides: Record<string, string | undefined> = {}) => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    DATABASE_URL: "https://example.com/db",
    ENCRYPTION_KEY: "12345678901234567890123456789012",
    HUB_API_URL: "https://hub.formbricks.local",
    HUB_API_KEY: "test-hub-api-key",
    CUBEJS_API_URL: "https://cube.formbricks.local",
    CUBEJS_API_SECRET: "cube-secret",
    // Explicitly cleared, like the AUTHZED_* block in env.test.ts: `.env` is loaded into process.env
    // by vite.config.mts, and CI's `pnpm dev:setup` puts a secret in it — so without this every
    // assertion below would be satisfied by ambient values rather than by the case under test.
    BETTER_AUTH_SECRET: undefined,
    BETTER_AUTH_URL: undefined,
    NEXTAUTH_SECRET: undefined,
    NEXTAUTH_URL: undefined,
    ...overrides,
  };
};

// `importActual`, not `import`: vitestSetup.ts mocks "@/lib/constants" globally for every unit test,
// and that mock's factory result is cached — so a plain dynamic import would hand back the first
// test's values no matter what `setTestEnv` did. `resetModules` first so env.ts re-parses.
const loadConstants = async () => {
  vi.resetModules();
  return await vi.importActual<typeof import("./constants")>("./constants");
};

describe("auth secret and URL resolution", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test("prefers BETTER_AUTH_SECRET over NEXTAUTH_SECRET", async () => {
    setTestEnv({ BETTER_AUTH_SECRET, NEXTAUTH_SECRET });

    const { AUTH_SECRET } = await loadConstants();

    expect(AUTH_SECRET).toBe(BETTER_AUTH_SECRET);
  });

  test("falls back to NEXTAUTH_SECRET when BETTER_AUTH_SECRET is unset", async () => {
    // Every instance that upgraded from v5.1 or earlier is in exactly this configuration, and nothing
    // ever rewrites its env — so this fallback is permanent, not a deprecation window.
    setTestEnv({ NEXTAUTH_SECRET });

    const { AUTH_SECRET } = await loadConstants();

    expect(AUTH_SECRET).toBe(NEXTAUTH_SECRET);
  });

  test("is undefined when neither secret is set", async () => {
    setTestEnv();

    const { AUTH_SECRET } = await loadConstants();

    expect(AUTH_SECRET).toBeUndefined();
  });

  test("prefers BETTER_AUTH_URL over NEXTAUTH_URL, and falls back to it", async () => {
    setTestEnv({
      BETTER_AUTH_URL: "https://auth.example.com",
      NEXTAUTH_URL: "https://legacy.example.com",
    });
    expect((await loadConstants()).AUTH_URL).toBe("https://auth.example.com");

    setTestEnv({ NEXTAUTH_URL: "https://legacy.example.com" });
    expect((await loadConstants()).AUTH_URL).toBe("https://legacy.example.com");

    setTestEnv();
    expect((await loadConstants()).AUTH_URL).toBeUndefined();
  });

  test("trusts every configured origin, not just the winning one", async () => {
    // An instance mid-rename has both set; Better Auth's origin check must accept requests arriving on
    // either, or sign-in fails closed on whichever host the operator has not switched over yet.
    setTestEnv({
      BETTER_AUTH_URL: "https://auth.example.com",
      NEXTAUTH_URL: "https://legacy.example.com",
    });

    const { AUTH_TRUSTED_ORIGINS } = await loadConstants();

    expect(AUTH_TRUSTED_ORIGINS).toStrictEqual(["https://auth.example.com", "https://legacy.example.com"]);
  });

  test("trusted origins is empty when no auth URL is configured", async () => {
    setTestEnv();

    const { AUTH_TRUSTED_ORIGINS } = await loadConstants();

    expect(AUTH_TRUSTED_ORIGINS).toStrictEqual([]);
  });

  describe("an empty or blank value counts as unset", () => {
    // `??` would return "" here, because an empty string is not nullish — and "" is falsy, so it fails
    // every consumer's guard *and* lets Better Auth fall through to its own hardcoded default secret,
    // on an instance whose NEXTAUTH_SECRET was perfectly good.
    //
    // env.ts rejects a blank secret outright (see env.test.ts), so this is the second line of defence,
    // driven through a mocked env because the first one would otherwise stop the case from arising.
    // It keeps the invariant local to the resolution instead of resting on a distant schema.
    const loadWithEnv = async (values: Record<string, string | undefined>) => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({ env: values }));
      const constants = await vi.importActual<typeof import("./constants")>("./constants");
      vi.doUnmock("@/lib/env");
      return constants;
    };

    test("an empty BETTER_AUTH_SECRET does not shadow NEXTAUTH_SECRET", async () => {
      const { AUTH_SECRET } = await loadWithEnv({ BETTER_AUTH_SECRET: "", NEXTAUTH_SECRET });

      expect(AUTH_SECRET).toBe(NEXTAUTH_SECRET);
    });

    test("a whitespace-only BETTER_AUTH_SECRET does not shadow NEXTAUTH_SECRET", async () => {
      const { AUTH_SECRET } = await loadWithEnv({ BETTER_AUTH_SECRET: "   ", NEXTAUTH_SECRET });

      expect(AUTH_SECRET).toBe(NEXTAUTH_SECRET);
    });

    test('an empty secret on its own resolves to undefined, never to ""', async () => {
      const { AUTH_SECRET } = await loadWithEnv({ BETTER_AUTH_SECRET: "" });

      expect(AUTH_SECRET).toBeUndefined();
    });

    test("a blank auth URL is neither resolved nor trusted", async () => {
      const { AUTH_TRUSTED_ORIGINS, AUTH_URL } = await loadWithEnv({
        BETTER_AUTH_URL: "   ",
        NEXTAUTH_URL: "https://legacy.example.com",
      });

      expect(AUTH_URL).toBe("https://legacy.example.com");
      expect(AUTH_TRUSTED_ORIGINS).toStrictEqual(["https://legacy.example.com"]);
    });
  });
});
