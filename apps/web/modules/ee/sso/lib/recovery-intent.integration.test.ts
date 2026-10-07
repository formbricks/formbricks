import crypto from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import { cache } from "@/lib/cache";
import {
  consumeSsoRecoveryIntent,
  createSsoRecoveryIntent,
  getSsoRecoveryPairedTtlSeconds,
  readSsoRecoveryIntent,
  refreshSsoRecoveryIntent,
} from "./recovery-intent";

/**
 * The intent store against real Redis (ENG-2783).
 *
 * The unit suite fakes `cache.getRedisClient()`, so the one thing it structurally cannot check is the
 * semantics the resurrection guard rests on: that `EXPIRE` is a no-op on a key that is already gone.
 * That is Redis behaviour rather than ours, and until this file it had never been executed — the guard
 * was verified against a hand-written fake of the very command it depends on.
 *
 * The key is recomputed here rather than imported, which also makes this an independent check that the
 * derivation is what the module claims: `fb:sso_recovery:intent:<sha256(stateId)>`.
 */

const LINK_TTL_SECONDS = 60 * 15;

const intentInput = {
  userId: "cm5q1x2y30000abcdefghijkl",
  email: "store@example.com",
  provider: "google",
  providerAccountId: "google-sub-store",
  callbackUrl: "http://localhost:3000/organizations/org_1/workspaces/ws_1/surveys",
};

const keyFor = (stateId: string) =>
  `fb:sso_recovery:intent:${crypto.createHash("sha256").update(stateId).digest("hex")}`;

const redisClient = async () => {
  const redis = await cache.getRedisClient();
  expect(redis).not.toBeNull();
  return redis!;
};

/** Redis `TTL`: seconds remaining, -2 when the key is gone, -1 when it has no expiry. */
const ttlOf = async (stateId: string) => (await redisClient()).ttl(keyFor(stateId));

describe("SSO recovery intent store (real Redis)", () => {
  beforeEach(async () => {
    await redisClient();
  });

  test("round-trips through Redis under the hashed key, at the emailed link's TTL", async () => {
    const stateId = await createSsoRecoveryIntent(intentInput);

    await expect(readSsoRecoveryIntent(stateId)).resolves.toMatchObject(intentInput);
    // The raw id is the lookup secret; only its digest may be at rest.
    expect(keyFor(stateId)).not.toContain(stateId);
    await expect(redisClient().then((r) => r.exists(keyFor(stateId)))).resolves.toBe(1);
    expect(await ttlOf(stateId)).toBeGreaterThan(LINK_TTL_SECONDS - 60);
  });

  test("a resend extends a TTL that has run down", async () => {
    const stateId = await createSsoRecoveryIntent(intentInput);
    const stored = (await readSsoRecoveryIntent(stateId))!;
    // Stand in for most of the window having passed since the link was issued.
    await (await redisClient()).expire(keyFor(stateId), 60);
    expect(await ttlOf(stateId)).toBeLessThanOrEqual(60);

    await refreshSsoRecoveryIntent(stateId, getSsoRecoveryPairedTtlSeconds(stored));

    expect(await ttlOf(stateId)).toBeGreaterThan(LINK_TTL_SECONDS - 60);
    // EXPIRE moves the expiry only: the record itself must come back byte-identical.
    await expect(readSsoRecoveryIntent(stateId)).resolves.toEqual(stored);
  });

  /** The guard the unit test could only assert against a fake of `EXPIRE`. */
  test("a resend racing a completion cannot resurrect the consumed intent", async () => {
    const stateId = await createSsoRecoveryIntent(intentInput);
    const stored = (await readSsoRecoveryIntent(stateId))!;

    await consumeSsoRecoveryIntent(stateId);
    expect(await ttlOf(stateId)).toBe(-2); // gone

    await refreshSsoRecoveryIntent(stateId, getSsoRecoveryPairedTtlSeconds(stored));

    expect(await ttlOf(stateId)).toBe(-2); // still gone — EXPIRE did not recreate it
    await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();
  });

  test("consuming removes the key rather than merely expiring it", async () => {
    const stateId = await createSsoRecoveryIntent(intentInput);

    await consumeSsoRecoveryIntent(stateId);

    await expect(redisClient().then((r) => r.exists(keyFor(stateId)))).resolves.toBe(0);
    await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();
  });

  test("two intents never collide, and each is independently consumable", async () => {
    const first = await createSsoRecoveryIntent(intentInput);
    const second = await createSsoRecoveryIntent({ ...intentInput, userId: "other-user" });

    await consumeSsoRecoveryIntent(first);

    await expect(readSsoRecoveryIntent(first)).resolves.toBeNull();
    await expect(readSsoRecoveryIntent(second)).resolves.toMatchObject({ userId: "other-user" });
  });
});
