import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { SSO_RELINK_INTENT_TTL_SECONDS } from "@/lib/sso-relink-intent-ttl";
import { loggableError } from "@/lib/utils/loggable-error";

/**
 * One request at a time acts on a recovery, and none after it has been linked or cancelled (ENG-7395).
 *
 * On this release line a recovery is only its signed intent: there is no server-side record to delete.
 * So the recovery id (a hash of the intent, see `getSsoRecoveryStateId`) keys two Redis entries:
 * - a claim, held while one Link or Cancel runs, so a Link and a Cancel clicked together cannot both act;
 * - a spent marker, set once one of them finished, so the emailed link cannot be used again afterwards.
 *   It outlives the intent, which expires on its own after that.
 */

// Redis Cluster (ElastiCache Serverless on Cloud) runs a Lua call only when all its keys share a hash slot,
// and the claim script reads the spent marker and writes the claim in one call. The braces make both keys
// hash on the recovery id alone, so they land in the same slot.
const getSpentCacheKey = (stateId: string) => createCacheKey.custom("sso_recovery", `{${stateId}}`, "spent");
const getClaimCacheKey = (stateId: string) => createCacheKey.custom("sso_recovery", `{${stateId}}`, "claim");

/**
 * How long a claim holds when its owner never releases it (a crashed request). Longer than anything a
 * completion does while holding it, the linking transaction's 5-second Prisma default included.
 */
const CLAIM_TTL_MS = 2 * 60 * 1000;

/**
 * At least as long as any intent the marker refers to can still verify. Counted from the spend, which is
 * after the intent was minted, so the marker outlives the intent's own expiry; the 60 seconds cover
 * clock skew between the node that writes the marker and a node that later verifies the intent.
 */
const SPENT_TTL_MS = (SSO_RELINK_INTENT_TTL_SECONDS + 60) * 1000;

// Claims only while the recovery is unspent, in one step: a Link that lost to a Cancel cannot claim
// afterwards, and no request can claim between the check and the claim.
const CLAIM_IF_UNSPENT_SCRIPT = `
  if redis.call('EXISTS', KEYS[1]) == 1 then
    return 0
  end
  if redis.call('SET', KEYS[2], ARGV[1], 'NX', 'PX', ARGV[2]) then
    return 1
  end
  return 2
`;

// Deletes the claim only while it is still this request's, so a release that runs after the claim
// expired and someone else took it cannot free theirs.
const RELEASE_CLAIM_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

/**
 * `claimed` may act and must release. The rest may not act: `held` is another Link or Cancel in flight,
 * `spent` is a recovery already linked or cancelled, and `unavailable` is Redis not answering.
 */
export type TSsoRecoveryClaim =
  | { kind: "claimed"; release: () => Promise<void> }
  | { kind: "held" }
  | { kind: "spent" }
  | { kind: "unavailable" };

const getRedis = async () => {
  const redis = await cache.getRedisClient();
  if (!redis) throw new Error("Redis is unavailable");
  return redis;
};

/** Claims the recovery for one Link or Cancel. Never throws. */
export const claimSsoRecovery = async (stateId: string): Promise<TSsoRecoveryClaim> => {
  const claimKey = getClaimCacheKey(stateId);
  const token = crypto.randomUUID();
  const release = async () => {
    try {
      const redis = await getRedis();
      await redis.eval(RELEASE_CLAIM_SCRIPT, { keys: [claimKey], arguments: [token] });
    } catch (error) {
      // It expires on its own; only a retry within that window is held up.
      logger.error({ ...loggableError(error), stateId }, "Failed to release the SSO recovery claim");
    }
  };

  try {
    const redis = await getRedis();
    const claimed = await redis.eval(CLAIM_IF_UNSPENT_SCRIPT, {
      keys: [getSpentCacheKey(stateId), claimKey],
      arguments: [token, String(CLAIM_TTL_MS)],
    });
    if (claimed === 0) return { kind: "spent" };
    if (claimed !== 1) return { kind: "held" };
  } catch (error) {
    logger.error({ ...loggableError(error), stateId }, "Failed to claim the SSO recovery");
    return { kind: "unavailable" };
  }

  return { kind: "claimed", release };
};

/**
 * Marks the recovery used, so its link cannot link or cancel again. `true` when the marker was written.
 * Never throws: after a link the account is already linked, and failing here must not turn that into an
 * error. The caller keeps its claim when this fails, which blocks the recovery for the claim's lifetime.
 */
export const markSsoRecoverySpent = async (stateId: string): Promise<boolean> => {
  try {
    const redis = await getRedis();
    await redis.set(getSpentCacheKey(stateId), "1", { PX: SPENT_TTL_MS });
    return true;
  } catch (error) {
    logger.error({ ...loggableError(error), stateId }, "Failed to mark the SSO recovery spent");
    return false;
  }
};
