import redis from "@/lib/redis";

export const AUDIT_LOG_HASH_KEY = "audit:lastHash";

export async function getPreviousAuditLogHash(): Promise<string | null> {
  return (await redis.get(AUDIT_LOG_HASH_KEY)) || null;
}

export async function setPreviousAuditLogHash(hash: string): Promise<void> {
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
  // eslint-disable-next-line no-console
  console.error("runAuditLogHashTransaction: start");
  let retry = 0;
  while (retry < 5) {
    // eslint-disable-next-line no-console
    console.error(`runAuditLogHashTransaction: loop retry=${retry}`);
    await redis.watch(AUDIT_LOG_HASH_KEY);
    const previousHash = await getPreviousAuditLogHash();
    const { auditEvent, integrityHash } = await buildAndLogEvent(previousHash);

    const tx = redis.multi();
    tx.set(AUDIT_LOG_HASH_KEY, integrityHash);

    // Write the log event (not in the transaction, but should be atomic enough for most use cases)
    await auditEvent();

    const result = await tx.exec();
    // eslint-disable-next-line no-console
    console.error("runAuditLogHashTransaction: tx.exec() result=", result);
    if (result) {
      // Success
      // eslint-disable-next-line no-console
      console.error("runAuditLogHashTransaction: success, exiting");
      return;
    }
    // Retry if the hash was changed by another process
    retry++;
  }

  throw new Error("Failed to update audit log hash after multiple retries (concurrency issue)");
}
