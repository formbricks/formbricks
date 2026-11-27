import { createCipheriv, randomBytes } from "node:crypto";
import { logger } from "@formbricks/logger";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-7311: encrypts the OAuth tokens of the Slack, Google Sheets and Airtable integrations at rest, as
 * the Notion integration already does. Notion is not touched: it has always stored an encrypted token.
 *
 * Self-contained on purpose: `apps/web/lib/crypto.ts` is not importable from this package, so the
 * AES-256-GCM format is mirrored here (`<iv hex>:<ciphertext hex>:<tag hex>`, key read as latin1 when the
 * `ENCRYPTION_KEY` is 32 characters and as hex otherwise). A test in `apps/web` decrypts this output
 * with `symmetricDecrypt` so the two cannot drift apart unnoticed.
 *
 * **Rolling upgrade.** The app reads tolerantly (a token is decrypted only if it has the encrypted
 * shape, and a legacy plaintext one is used as it is), so nothing has to be reconnected. A pod of the
 * previous release that is still serving while this runs reads the encrypted tokens as plaintext, so its
 * Slack, Google Sheets and Airtable deliveries fail until it is replaced. It does not delete or
 * disconnect anything (Google `invalid_grant` and Airtable refresh failures only reject the call), and
 * the next response delivers normally once the new pods serve. A token an old pod refreshes after this
 * runs is written back as plaintext; a new pod encrypts it on its next write.
 *
 * **Idempotent and race-safe.** Only values that are not already in the encrypted shape are candidates.
 * Each row is written with a compare-and-set on the `config` it was read with, so a token an old pod
 * refreshed in the meantime is re-read and encrypted on a retry instead of being overwritten.
 */
const INTEGRATION_TYPES = ["slack", "googleSheets", "airtable"] as const;
const CREDENTIAL_FIELDS = ["access_token", "refresh_token"] as const;
const BATCH_SIZE = 100;
const MAX_RACE_RETRIES = 3;
const IV_LENGTH = 16;

/** `symmetricEncrypt` output shape. A provider token is never in it. */
const ENCRYPTED_VALUE_PATTERN = /^[0-9a-f]{32}:[0-9a-f]*:[0-9a-f]{32}$/;
// The same predicate in SQL: a candidate is a row with a non-empty credential that is not yet encrypted.
const ENCRYPTED_VALUE_REGEX = "^[0-9a-f]{32}:[0-9a-f]*:[0-9a-f]{32}$";
const NEEDS_ENCRYPTION = CREDENTIAL_FIELDS.map(
  (field) =>
    `(COALESCE(x."config"->'key'->>'${field}', '') <> '' AND x."config"->'key'->>'${field}' !~ '${ENCRYPTED_VALUE_REGEX}')`
).join(" OR ");

type TPrismaHandle = DataMigrationContext["prisma"];
type TIntegrationRow = { id: string; config: unknown };

export interface TIntegrationTokenBackfillStats {
  scanned: number;
  updated: number;
  raceRetries: number;
  skipped: string[];
}

const getKeyBuffer = (encryptionKey: string): Buffer => {
  const key = Buffer.from(encryptionKey, encryptionKey.length === 32 ? "latin1" : "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 characters or 64 hex characters to encrypt integration tokens"
    );
  }
  return key;
};

/** Same output as `symmetricEncrypt` in `apps/web/lib/crypto.ts`. */
export const encryptToken = (text: string, encryptionKey: string): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getKeyBuffer(encryptionKey), iv);
  const ciphered = cipher.update(text, "utf8", "hex") + cipher.final("hex");
  return `${iv.toString("hex")}:${ciphered}:${cipher.getAuthTag().toString("hex")}`;
};

/** The config with every plaintext credential encrypted, or `null` when there is nothing to encrypt. */
export const encryptConfigCredentials = (config: unknown, encryptionKey: string): unknown => {
  const key = (config as { key?: unknown } | null)?.key;
  if (!key || typeof key !== "object") return null;

  const nextKey: Record<string, unknown> = { ...(key as Record<string, unknown>) };
  let changed = false;
  for (const field of CREDENTIAL_FIELDS) {
    const value = nextKey[field];
    if (typeof value === "string" && value !== "" && !ENCRYPTED_VALUE_PATTERN.test(value)) {
      nextKey[field] = encryptToken(value, encryptionKey);
      changed = true;
    }
  }
  return changed ? { ...(config as object), key: nextKey } : null;
};

const fetchPage = (prisma: TPrismaHandle, cursor: string): Promise<TIntegrationRow[]> =>
  prisma.$queryRawUnsafe<TIntegrationRow[]>(
    `SELECT x."id", x."config" FROM "Integration" x
     WHERE x."id" > $1 AND x."type"::text = ANY($2::text[]) AND (${NEEDS_ENCRYPTION})
     ORDER BY x."id" LIMIT $3`,
    cursor,
    [...INTEGRATION_TYPES],
    BATCH_SIZE
  );

const fetchByIds = (prisma: TPrismaHandle, ids: string[]): Promise<TIntegrationRow[]> =>
  prisma.$queryRawUnsafe<TIntegrationRow[]>(
    `SELECT x."id", x."config" FROM "Integration" x
     WHERE x."id" = ANY($1::text[]) AND x."type"::text = ANY($2::text[]) AND (${NEEDS_ENCRYPTION})`,
    ids,
    [...INTEGRATION_TYPES]
  );

/** Writes one row if its `config` is still the one that was read. True when it was written. */
const writeRow = async (prisma: TPrismaHandle, row: TIntegrationRow, next: unknown): Promise<boolean> => {
  const written = await prisma.$executeRawUnsafe(
    `UPDATE "Integration" SET "config" = $1::jsonb WHERE "id" = $2 AND "config" = $3::jsonb`,
    JSON.stringify(next),
    row.id,
    JSON.stringify(row.config)
  );
  return Number(written) === 1;
};

const processRows = async (
  prisma: TPrismaHandle,
  rows: TIntegrationRow[],
  encryptionKey: string,
  stats: TIntegrationTokenBackfillStats
): Promise<string[]> => {
  const lost: string[] = [];
  for (const row of rows) {
    const next = encryptConfigCredentials(row.config, encryptionKey);
    if (next === null) continue;
    if (await writeRow(prisma, row, next)) stats.updated += 1;
    else lost.push(row.id);
  }
  return lost;
};

/**
 * Encrypts every plaintext credential, in committed chunks on the autocommit handle so no transaction
 * outlives a chunk. Walks by keyset on `id`, not OFFSET: an encrypted row leaves the candidate set.
 */
export const backfillIntegrationTokens = async (
  prisma: TPrismaHandle,
  encryptionKey: string | undefined
): Promise<TIntegrationTokenBackfillStats> => {
  const stats: TIntegrationTokenBackfillStats = { scanned: 0, updated: 0, raceRetries: 0, skipped: [] };
  let cursor = "";

  for (;;) {
    const rows = await fetchPage(prisma, cursor);
    if (rows.length === 0) break;
    // Rows exist that need the key: refuse to continue without it, loudly, before anything is written.
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_KEY is not set, so the stored integration tokens cannot be encrypted");
    }
    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;

    let lost = await processRows(prisma, rows, encryptionKey, stats);
    for (let attempt = 1; lost.length > 0 && attempt <= MAX_RACE_RETRIES; attempt++) {
      stats.raceRetries += lost.length;
      lost = await processRows(prisma, await fetchByIds(prisma, lost), encryptionKey, stats);
    }
    if (lost.length > 0) {
      stats.skipped.push(...lost);
      logger.warn({ ids: lost }, "Skipped integrations that kept changing during the token backfill");
    }
  }

  logger.info(
    `Integration token backfill complete: ${stats.scanned.toString()} scanned, ${stats.updated.toString()} updated, ${stats.raceRetries.toString()} race retries, ${stats.skipped.length.toString()} skipped`
  );
  return stats;
};

export const encryptIntegrationTokens: MigrationScript = {
  type: "data",
  id: "p4n7wq2kd9vh5xeb3tmz8c6a",
  name: "20261123120000_encrypt_integration_tokens",
  // `tx` is deliberately unused: the work commits in chunks on `prisma` (see backfillIntegrationTokens).
  // The migration runs in the app image, whose environment carries the same `ENCRYPTION_KEY` as the pods.
  run: async ({ prisma }) => {
    await backfillIntegrationTokens(prisma, process.env.ENCRYPTION_KEY);
  },
};
