import redis from "@/modules/cache/redis";
import { logger } from "@formbricks/logger";

export const AUDIT_LOG_HASH_KEY = "audit:lastHash";

export async function getPreviousAuditLogHash(): Promise<string | null> {
  if (!redis) {
    logger.error("Redis is not initialized");
    return null;
  }

  return (await redis.get(AUDIT_LOG_HASH_KEY)) ?? null;
}

export async function setPreviousAuditLogHash(hash: string): Promise<void> {
  if (!redis) {
    logger.error("Redis is not initialized");
    return;
  }

  await redis.set(AUDIT_LOG_HASH_KEY, hash);
}

/**
 * Runs a concurrency-safe Redis transaction for the audit log hash chain.
 * The callback receives the previous hash and should return the audit event to log.
 * Handles retries and atomicity.
 */
export async function runAuditLogHashTransaction(
  buildAndLogEvent: (previousHash: string | null) => Promise<{ auditEvent: any; integrityHash: string }>
): Promise<void> {
  let retry = 0;
  while (retry < 5) {
    if (!redis) {
      logger.error("Redis is not initialized");
      throw new Error("Redis is not initialized");
    }

    let result;
    let auditEvent;
    try {
      await redis.watch(AUDIT_LOG_HASH_KEY);
      const previousHash = await getPreviousAuditLogHash();
      const buildResult = await buildAndLogEvent(previousHash);
      auditEvent = buildResult.auditEvent;
      const integrityHash = buildResult.integrityHash;

      const tx = redis.multi();
      tx.set(AUDIT_LOG_HASH_KEY, integrityHash);

      result = await tx.exec();
    } finally {
      await redis.unwatch();
    }
    if (result) {
      // Success: now log the audit event
      await auditEvent();
      return;
    }
    // Retry if the hash was changed by another process
    retry++;
  }
  // Debug log for test diagnostics
  // eslint-disable-next-line no-console
  console.error("runAuditLogHashTransaction: throwing after 5 retries");
  throw new Error("Failed to update audit log hash after multiple retries (concurrency issue)");
}
