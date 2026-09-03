import { beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import {
  type TSsoRecoveryIntent,
  consumeSsoRecoveryIntent,
  createSsoRecoveryIntent,
  readSsoRecoveryIntent,
  refreshSsoRecoveryIntent,
} from "./recovery-intent";

/**
 * `vitestSetup.ts` stubs `crypto.createHash` to the constant `"fake-hash"` for the license checks. This
 * module derives its cache key from `sha256(stateId)`, so under that stub every state id collapses onto
 * one key: two intents would overwrite each other and a key-derivation regression would be invisible.
 * Restore the real implementation for this file — the store below depends on keys actually differing.
 */
vi.mock("crypto", async () => await vi.importActual<typeof import("crypto")>("crypto"));

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

vi.mock("@/lib/cache", () => ({
  cache: { get: vi.fn(), set: vi.fn(), del: vi.fn(), getRedisClient: vi.fn() },
}));

const mockCache = vi.mocked(cache);

/**
 * A real store rather than assertions on `cache.set` call arguments.
 *
 * Reading back through the same key derivation is what makes the round-trip tests bind anything: with
 * `expect(cache.set).toHaveBeenCalledWith(...)` the key could be the raw state id, or a constant, and
 * every test would still pass.
 */
const store = new Map<string, { value: unknown; ttlMs?: number }>();

const LINK_TTL_MS = 60 * 60 * 24 * 1000;
const MAX_LIFETIME_MS = 60 * 60 * 24 * 7 * 1000;

const intentInput = {
  userId: "cm5q1x2y30000abcdefghijkl",
  email: "matti@formbricks.com",
  provider: "azuread",
  providerAccountId: "00000000-1111-2222-3333-444444444444",
  callbackUrl: "https://test-webapp-url.com/workspaces/abc/surveys",
};

describe("SSO recovery intent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    store.clear();

    mockCache.set.mockImplementation(async (key: string, value: unknown, ttlMs?: number) => {
      store.set(key, { value, ttlMs });
      return { ok: true, data: undefined };
    });
    mockCache.get.mockImplementation(async (key: string) => ({
      ok: true,
      // The real service JSON round-trips, so mirror that rather than handing back the same object.
      data: store.has(key) ? JSON.parse(JSON.stringify(store.get(key)!.value)) : null,
    }));
    mockCache.del.mockImplementation(async (keys: string[]) => {
      keys.forEach((key) => store.delete(key));
      return { ok: true, data: undefined };
    });
    // Real EXPIRE semantics, which is the whole point of using it: a no-op returning 0 on a key that is
    // no longer there. A stub that always "succeeded" would hide the resurrection this guards against.
    mockCache.getRedisClient.mockResolvedValue({
      expire: vi.fn(async (key: string, seconds: number) => {
        const entry = store.get(key);
        if (!entry) return 0;
        store.set(key, { ...entry, ttlMs: seconds * 1000 });
        return 1;
      }),
    } as never);
  });

  describe("create", () => {
    test("returns an opaque 43-character base64url state id", async () => {
      await expect(createSsoRecoveryIntent(intentInput)).resolves.toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    test("round-trips the intent", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);

      await expect(readSsoRecoveryIntent(stateId)).resolves.toEqual({
        ...intentInput,
        createdAt: expect.any(Number),
      });
    });

    test("mints a distinct state id and key per intent, so two recoveries cannot collide", async () => {
      const first = await createSsoRecoveryIntent(intentInput);
      const second = await createSsoRecoveryIntent({ ...intentInput, userId: "other-user" });

      expect(first).not.toBe(second);
      expect(store.size).toBe(2);
      await expect(readSsoRecoveryIntent(first)).resolves.toMatchObject({ userId: intentInput.userId });
      await expect(readSsoRecoveryIntent(second)).resolves.toMatchObject({ userId: "other-user" });
    });

    test("keys on the hash, never on the state id itself", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);
      const [key] = [...store.keys()];

      expect(key).not.toContain(stateId);
      expect(key).toMatch(/^fb:sso_recovery:intent:[0-9a-f]{64}$/);
    });

    test("stores nothing the URL used to carry in the clear", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);

      // The state id is the whole of what travels; it must not encode the identity it stands for.
      expect(stateId).not.toContain(intentInput.userId);
      expect(stateId).not.toContain(intentInput.email);
    });

    test("stores with the verification-link TTL, so the link cannot outlive the intent", async () => {
      await createSsoRecoveryIntent(intentInput);

      expect([...store.values()][0].ttlMs).toBe(LINK_TTL_MS);
    });

    test("throws when the write fails, rather than emailing a link that cannot work", async () => {
      mockCache.set.mockResolvedValue({ ok: false, error: { code: "RedisConnectionError" } });

      await expect(createSsoRecoveryIntent(intentInput)).rejects.toThrow(
        "Unable to store the SSO recovery intent"
      );
    });
  });

  describe("read", () => {
    test("returns null for an id that was never issued", async () => {
      await expect(readSsoRecoveryIntent("a".repeat(43))).resolves.toBeNull();
    });

    test.each([
      ["absent", undefined],
      ["empty", ""],
      ["too short", "a".repeat(42)],
      ["too long", "a".repeat(44)],
      ["not base64url", `${"a".repeat(42)}+`],
    ])("rejects a %s state id without touching Redis", async (_label, stateId) => {
      await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    test("returns null rather than throwing when the cache is unreachable", async () => {
      mockCache.get.mockResolvedValue({ ok: false, error: { code: "RedisConnectionError" } });

      await expect(readSsoRecoveryIntent("a".repeat(43))).resolves.toBeNull();
    });

    /**
     * The check that replaces the JWT signature. A Redis value carries no integrity guarantee, so every
     * field is validated on the way out — `callbackUrl` becomes a redirect and `providerAccountId`
     * becomes the SSO identity linked to the account, and a cast would hand both straight through.
     */
    test.each([
      ["a missing userId", { ...intentInput, userId: undefined }],
      ["a missing email", { ...intentInput, email: undefined }],
      ["a missing provider", { ...intentInput, provider: undefined }],
      ["a missing providerAccountId", { ...intentInput, providerAccountId: undefined }],
      ["a missing callbackUrl", { ...intentInput, callbackUrl: undefined }],
      ["a non-string callbackUrl", { ...intentInput, callbackUrl: { href: "https://evil.example" } }],
      ["a non-string providerAccountId", { ...intentInput, providerAccountId: 42 }],
      ["an empty userId", { ...intentInput, userId: "" }],
      ["a missing createdAt", { ...intentInput }],
      ["a non-numeric createdAt", { ...intentInput, createdAt: "yesterday" }],
    ])("discards a stored record with %s", async (_label, stored) => {
      const stateId = await createSsoRecoveryIntent(intentInput);
      const [key] = [...store.keys()];
      store.set(key, { value: stored });

      await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();
    });
  });

  describe("consume", () => {
    test("removes the record, so a completed recovery cannot be replayed", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);

      await consumeSsoRecoveryIntent(stateId);

      await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();
    });

    test("never throws when the delete fails — the account link has already committed", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);
      mockCache.del.mockResolvedValue({ ok: false, error: { code: "RedisConnectionError" } });

      await expect(consumeSsoRecoveryIntent(stateId)).resolves.toBeUndefined();
    });
  });

  describe("refresh", () => {
    const storedIntent = (createdAt: number): TSsoRecoveryIntent => ({ ...intentInput, createdAt });

    test("re-pairs a resent link with a full TTL while well inside the absolute lifetime", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);

      await refreshSsoRecoveryIntent(stateId, storedIntent(Date.now()));

      expect([...store.values()][0].ttlMs).toBe(LINK_TTL_MS);
    });

    /**
     * A resend and a completion can race. Refresh must extend a live record, never write one back —
     * otherwise a resend landing just after completion resurrects the intent that completion consumed,
     * and single use quietly stops holding.
     */
    test("cannot resurrect an intent that a completion already consumed", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);
      await consumeSsoRecoveryIntent(stateId);

      await refreshSsoRecoveryIntent(stateId, storedIntent(Date.now()));

      expect(store.size).toBe(0);
      await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();
    });

    test("does nothing when Redis is unavailable, rather than throwing at the caller", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);
      mockCache.getRedisClient.mockResolvedValue(null);

      await expect(refreshSsoRecoveryIntent(stateId, storedIntent(Date.now()))).resolves.toBeUndefined();
    });

    /**
     * `resendVerificationEmailAction` is unauthenticated, so a plain sliding window would let anyone
     * holding a state id keep an intent alive forever. `createdAt` never moves, so the slide is capped.
     */
    test("clamps the TTL so a refresh cannot push expiry past the absolute lifetime", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);
      // Six and a half days in: less than one link TTL of absolute lifetime is left.
      const createdAt = Date.now() - (MAX_LIFETIME_MS - LINK_TTL_MS / 2);

      await refreshSsoRecoveryIntent(stateId, storedIntent(createdAt));

      const { ttlMs } = [...store.values()][0];
      expect(ttlMs).toBeLessThan(LINK_TTL_MS);
      expect(createdAt + ttlMs!).toBeLessThanOrEqual(createdAt + MAX_LIFETIME_MS);
    });

    test("writes nothing once the absolute lifetime has elapsed", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);
      mockCache.getRedisClient.mockClear();

      await refreshSsoRecoveryIntent(stateId, storedIntent(Date.now() - MAX_LIFETIME_MS - 1));

      expect(mockCache.getRedisClient).not.toHaveBeenCalled();
    });

    test("leaves the stored record untouched, so a refresh cannot write back a stale copy", async () => {
      const stateId = await createSsoRecoveryIntent(intentInput);

      await refreshSsoRecoveryIntent(stateId, storedIntent(Date.now() - LINK_TTL_MS));

      // The intent handed in carries a different createdAt; the record must still hold its own.
      const stored = await readSsoRecoveryIntent(stateId);
      expect(stored?.createdAt).toBeGreaterThan(Date.now() - LINK_TTL_MS);
    });
  });
});
