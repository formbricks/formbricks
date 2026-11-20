import { beforeEach, describe, expect, test } from "vitest";
import { cache } from "@/lib/cache";
import { SSO_RELINK_INTENT_TTL_SECONDS } from "@/lib/sso-relink-intent-ttl";
import { claimSsoRecovery, markSsoRecoverySpent } from "./recovery-claim";

/** The claim scripts against a real Valkey: Lua, NX/PX and the cluster hash tag (ENG-7395). */
describe("SSO recovery claim (real Redis)", () => {
  let n = 0;
  const recoveryId = () => `claim-it-${Date.now()}-${n++}`;

  beforeEach(async () => {
    expect(await cache.getRedisClient()).not.toBeNull();
  });

  test("a recovery is claimed by one request at a time, and not at all once spent", async () => {
    const id = recoveryId();
    const first = await claimSsoRecovery(id);
    expect(first.kind).toBe("claimed");
    await expect(claimSsoRecovery(id)).resolves.toEqual({ kind: "held" });

    if (first.kind === "claimed") await first.release();
    const second = await claimSsoRecovery(id);
    expect(second.kind).toBe("claimed");
    if (second.kind === "claimed") await second.release();

    await expect(markSsoRecoverySpent(id)).resolves.toBe(true);
    await expect(claimSsoRecovery(id)).resolves.toEqual({ kind: "spent" });
  });

  test("the claim and the spent marker share one hash slot and both expire", async () => {
    const id = recoveryId();
    await claimSsoRecovery(id);
    await markSsoRecoverySpent(id);

    const redis = (await cache.getRedisClient())!;
    const keys = await redis.keys(`fb:sso_recovery:{${id}}:*`);
    expect(keys.sort()).toEqual([`fb:sso_recovery:{${id}}:claim`, `fb:sso_recovery:{${id}}:spent`]);
    const ttl = Object.fromEntries(await Promise.all(keys.map(async (key) => [key, await redis.pTTL(key)])));
    expect(ttl[`fb:sso_recovery:{${id}}:claim`]).toBeGreaterThan(0);
    // The marker must outlive any intent it refers to, or a spent intent would verify again.
    expect(ttl[`fb:sso_recovery:{${id}}:spent`]).toBeGreaterThan(SSO_RELINK_INTENT_TTL_SECONDS * 1000);
  });
});
