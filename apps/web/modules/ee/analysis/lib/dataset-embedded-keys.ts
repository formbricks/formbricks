import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { loggableError } from "@/lib/utils/loggable-error";
import type { TCubeQueryActor } from "@/modules/ee/analysis/api/lib/cube-config";
import {
  MAX_EMBEDDED_KEYS,
  MAX_RARE_EMBEDDED_KEYS,
  MAX_RARE_EMBEDDED_KEYS_BYTES,
  collectEmbeddedMemberNames,
  getEmbeddedKeyTokenBytes,
  isCompilableEmbeddedKey,
  selectEmbeddedKeys,
} from "./embedded-data-fields";
import { getEmbeddedMemberName } from "./embedded-member-name";

/**
 * A Feedback Dataset's embedded-data keys. Both reads below scan the whole dataset (seconds on
 * a large one), so each result is kept in Valkey and refreshed in the background once it is older than
 * `EMBEDDED_KEYS_STALE_MS`, under a lock across app instances: a request answers from what is cached and
 * never waits on a rescan. Only a dataset's very first scan is awaited, once per process however many
 * widgets ask at once, and a failed scan is remembered for `FAILED_SCAN_RETRY_MS` so requests do not
 * rescan a dataset Cube cannot answer for.
 *
 * Cube compiles one model per dataset and key set, and keeps a bounded number of them, so the key set
 * changes as rarely as it can: a refresh keeps the previous top keys until a material share of new keys
 * would enter them (`EMBEDDED_KEYS_MATERIAL_SHIFT`), and the rarer keys fall into buckets fixed by their
 * hash, so a new rare key reshuffles only its own class.
 */

/** How old a scan may get before a request refreshes it in the background. */
export const EMBEDDED_KEYS_STALE_MS = 15 * 60 * 1000;
/**
 * How many new keys must enter a full top-key set before a refresh replaces it. Fewer, and the previous
 * set is kept: a key climbing past another one by a few records does not recompile the dataset's models.
 * A key that would only be added (the set has room) always is.
 */
export const EMBEDDED_KEYS_MATERIAL_SHIFT = 10;
/** How many classes the rarer keys of a dataset are split into, by their member hash. */
export const RARE_EMBEDDED_KEY_CLASSES = 8;
/** How long a failed scan is remembered as "no keys" before a request tries again. */
export const FAILED_SCAN_RETRY_MS = 60 * 1000;
/** How long an entry is kept at all; a dataset nobody charts for a week is discovered afresh. */
const EMBEDDED_KEYS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** One refresh per dataset and scan at a time, across every app instance. */
const EMBEDDED_KEYS_REFRESH_LOCK_MS = 2 * 60 * 1000;
/**
 * Rows discovery asks for: more than the cap, so unusable keys can be dropped without losing the next
 * ones in line.
 */
const DISCOVERY_ROW_LIMIT = MAX_EMBEDDED_KEYS * 2;
/**
 * Most keys a saved query's members are looked for among, once one names a key outside the dataset's top
 * `MAX_EMBEDDED_KEYS`: such a key still exists, it is just less frequent now than when the chart was built.
 */
const RESOLUTION_ROW_LIMIT = 2000;

export const EMBEDDED_DATA_KEY_DIMENSION = "FeedbackRecords.embeddedDataKey";

type TCachedEmbeddedKeys = { keys: string[]; refreshedAt: number };
type TCachedKeyResolution = { members: Record<string, string>; scannedAt: number };

export type TEmbeddedKeysScope = {
  datasetId: string;
  workspaceId: string;
  organizationId: string;
  actor: TCubeQueryActor;
};

const keysCacheKey = (datasetId: string) => createCacheKey.custom("analytics", datasetId, "embedded-keys");
const keysLockKey = (datasetId: string) =>
  createCacheKey.custom("analytics", datasetId, "embedded-keys-lock");
const membersCacheKey = (datasetId: string) =>
  createCacheKey.custom("analytics", datasetId, "embedded-key-members");
const membersLockKey = (datasetId: string) =>
  createCacheKey.custom("analytics", datasetId, "embedded-key-members-lock");

const isCachedEmbeddedKeys = (value: unknown): value is TCachedEmbeddedKeys =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as TCachedEmbeddedKeys).keys) &&
  typeof (value as TCachedEmbeddedKeys).refreshedAt === "number";

const isCachedKeyResolution = (value: unknown): value is TCachedKeyResolution =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TCachedKeyResolution).members === "object" &&
  (value as TCachedKeyResolution).members !== null &&
  typeof (value as TCachedKeyResolution).scannedAt === "number";

/**
 * The dataset's keys ranked by how many records carry them, through Cube like every other read of the
 * dataset, on the plain model: the keys are what it is finding out. Imported lazily: the Cube client
 * resolves a dataset's keys through this module.
 */
const scanRankedKeys = async (scope: TEmbeddedKeysScope, limit: number): Promise<unknown[]> => {
  const { executeTenantScopedQuery } = await import("@/modules/ee/analysis/api/lib/cube-client");
  const rows = await executeTenantScopedQuery({
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: [EMBEDDED_DATA_KEY_DIMENSION],
      order: [
        ["FeedbackRecords.count", "desc"],
        [EMBEDDED_DATA_KEY_DIMENSION, "asc"],
      ],
      limit,
    },
    feedbackDirectoryId: scope.datasetId,
    workspaceId: scope.workspaceId,
    organizationId: scope.organizationId,
    actor: scope.actor,
    source: "charts.embeddedKeyDiscovery",
    embeddedKeys: [],
  });
  return rows.map((row) => row[EMBEDDED_DATA_KEY_DIMENSION]);
};

const storeOrWarn = async (key: string, value: unknown, ttlMs: number, datasetId: string): Promise<void> => {
  const result = await cache.set(key, value, ttlMs);
  if (!result.ok) logger.warn({ datasetId }, "Could not cache a dataset's embedded keys");
};

/** Scans running in this process, so a dashboard's widgets opening at once scan a dataset once. */
const inFlight = new Map<string, Promise<unknown>>();

const runOnce = <T>(key: string, scan: () => Promise<T>): Promise<T> => {
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const started = scan().finally(() => inFlight.delete(key));
  inFlight.set(key, started);
  return started;
};

/** Runs `scan` unless another instance already is; never throws, never awaited by a reader. */
const refreshInBackground = (lock: string, datasetId: string, scan: () => Promise<unknown>): void => {
  void (async () => {
    const acquired = await cache.tryLock(lock, "1", EMBEDDED_KEYS_REFRESH_LOCK_MS);
    if (!(acquired.ok && acquired.data)) return;
    await scan();
  })().catch((error: unknown) => {
    logger.warn({ ...loggableError(error), datasetId }, "Embedded-key refresh failed; kept the old keys");
  });
};

/**
 * The top keys a refresh stores, from the previous set and the fresh ranking. The previous set is kept,
 * with any new key added while there is room, unless `EMBEDDED_KEYS_MATERIAL_SHIFT` or more new keys
 * would enter the fresh top keys: then the fresh set replaces it.
 */
export const stabilizeTopEmbeddedKeys = (
  previous: readonly string[] | undefined,
  rankedKeys: readonly unknown[]
): string[] => {
  const fresh = selectEmbeddedKeys(rankedKeys);
  const kept = selectEmbeddedKeys(previous ?? []);
  if (kept.length === 0) return fresh;
  const keptSet = new Set(kept);
  const entering = fresh.filter((key) => !keptSet.has(key));
  if (entering.length >= EMBEDDED_KEYS_MATERIAL_SHIFT) return fresh;
  return selectEmbeddedKeys([...kept, ...entering]);
};

const discoverAndStore = (scope: TEmbeddedKeysScope, previous?: readonly string[]): Promise<string[]> =>
  runOnce(keysCacheKey(scope.datasetId), async () => {
    const keys = stabilizeTopEmbeddedKeys(previous, await scanRankedKeys(scope, DISCOVERY_ROW_LIMIT));
    const stored: TCachedEmbeddedKeys = { keys, refreshedAt: Date.now() };
    await storeOrWarn(keysCacheKey(scope.datasetId), stored, EMBEDDED_KEYS_TTL_MS, scope.datasetId);
    return keys;
  });

/**
 * The dataset's top keys, most frequent first. A failed first discovery answers no keys rather than
 * failing the chart: every chart without an embedded field still runs.
 */
export const getDatasetEmbeddedKeys = async (scope: TEmbeddedKeysScope): Promise<string[]> => {
  const cached = await cache.get<unknown>(keysCacheKey(scope.datasetId));
  // Without Valkey every request would rescan the dataset; charts without embedded fields still run.
  if (!cached.ok) {
    logger.warn({ datasetId: scope.datasetId }, "Cache unavailable; embedded keys are not offered");
    return [];
  }
  if (isCachedEmbeddedKeys(cached.data)) {
    if (Date.now() - cached.data.refreshedAt > EMBEDDED_KEYS_STALE_MS) {
      const previous = cached.data.keys;
      refreshInBackground(keysLockKey(scope.datasetId), scope.datasetId, () =>
        discoverAndStore(scope, previous)
      );
    }
    return selectEmbeddedKeys(cached.data.keys);
  }

  try {
    return await discoverAndStore(scope);
  } catch (error) {
    logger.warn({ ...loggableError(error), datasetId: scope.datasetId }, "Embedded-key discovery failed");
    const failed: TCachedEmbeddedKeys = { keys: [], refreshedAt: Date.now() };
    await storeOrWarn(keysCacheKey(scope.datasetId), failed, FAILED_SCAN_RETRY_MS, scope.datasetId);
    return [];
  }
};

/** Every key of the dataset (up to `RESOLUTION_ROW_LIMIT`), by the member it compiles to. */
const scanAndStoreMembers = (scope: TEmbeddedKeysScope): Promise<Record<string, string>> =>
  runOnce(membersCacheKey(scope.datasetId), async () => {
    const members: Record<string, string> = {};
    for (const key of await scanRankedKeys(scope, RESOLUTION_ROW_LIMIT)) {
      if (isCompilableEmbeddedKey(key)) members[getEmbeddedMemberName(key)] ??= key;
    }
    const stored: TCachedKeyResolution = { members, scannedAt: Date.now() };
    await storeOrWarn(membersCacheKey(scope.datasetId), stored, EMBEDDED_KEYS_TTL_MS, scope.datasetId);
    return members;
  });

/**
 * Every key of the dataset by member, from the cached scan. A member the scan does not know is looked
 * for again in the background once the scan is stale; this request answers without it. `undefined`
 * when there is no scan to read (Valkey down, or the first scan failed).
 */
const loadKeyMembers = async (
  scope: TEmbeddedKeysScope,
  wanted: readonly string[]
): Promise<Record<string, string> | undefined> => {
  const cached = await cache.get<unknown>(membersCacheKey(scope.datasetId));
  // Without Valkey every request would rescan, so nothing past the top keys resolves, as no key does then.
  if (!cached.ok) return undefined;
  if (isCachedKeyResolution(cached.data)) {
    const { members, scannedAt } = cached.data;
    const missing = wanted.some((member) => members[member] === undefined);
    if (missing && Date.now() - scannedAt > EMBEDDED_KEYS_STALE_MS) {
      refreshInBackground(membersLockKey(scope.datasetId), scope.datasetId, () => scanAndStoreMembers(scope));
    }
    return members;
  }

  try {
    return await scanAndStoreMembers(scope);
  } catch (error) {
    logger.warn({ ...loggableError(error), datasetId: scope.datasetId }, "Embedded-key resolution failed");
    const failed: TCachedKeyResolution = { members: {}, scannedAt: Date.now() };
    await storeOrWarn(membersCacheKey(scope.datasetId), failed, FAILED_SCAN_RETRY_MS, scope.datasetId);
    return undefined;
  }
};

/**
 * The keys behind `memberNames`, by member: each member a key of the dataset compiles to, whether or not
 * it is among the top keys. A member no key of the dataset compiles to is left out.
 */
export const resolveEmbeddedMemberKeys = async (
  scope: TEmbeddedKeysScope,
  memberNames: readonly string[]
): Promise<Map<string, string>> => {
  const resolved = new Map<string, string>();
  if (memberNames.length === 0) return resolved;

  const wanted = new Set(memberNames);
  for (const key of await getDatasetEmbeddedKeys(scope)) {
    const member = getEmbeddedMemberName(key);
    if (wanted.has(member)) resolved.set(member, key);
  }
  if (resolved.size === wanted.size) return resolved;

  const outside = [...wanted].filter((member) => !resolved.has(member));
  const members = await loadKeyMembers(scope, outside);
  for (const member of outside) {
    const key = members?.[member];
    if (key !== undefined) resolved.set(member, key);
  }
  return resolved;
};

/** UTF-16 code-unit order: what `Array.prototype.sort` uses with no compare function, unlike `localeCompare`. */
const byCodeUnit = (a: string, b: string): number => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

/** The order every token lists its keys in, the same as cube.js `getEmbeddedKeys` sorts them. */
const canonicalOrder = (keys: readonly string[]): string[] => [...keys].sort(byCodeUnit);

/** The member-name hash of a key: spreads keys evenly and never changes for a key. */
const keyHash = (key: string): string => getEmbeddedMemberName(key).slice(-8);

/** The class a rare key falls into: its member hash modulo `RARE_EMBEDDED_KEY_CLASSES`. */
export const getRareEmbeddedKeyClass = (key: string): number =>
  Number.parseInt(keyHash(key), 16) % RARE_EMBEDDED_KEY_CLASSES;

const byHashThenKey = (a: string, b: string): number => {
  const byHash = keyHash(a).localeCompare(keyHash(b));
  if (byHash !== 0) return byHash;
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

/**
 * The fixed buckets a dataset's rarer keys fall into: each key in the class its hash picks, and each class
 * ordered by hash and cut into runs of at most `MAX_RARE_EMBEDDED_KEYS` keys and
 * `MAX_RARE_EMBEDDED_KEYS_BYTES` token bytes (a class holds one run unless the dataset has hundreds of
 * rarer keys). The same keys always make the same buckets, whatever order they come in, and a new key
 * changes only the buckets of its own class.
 */
export const groupRareEmbeddedKeys = (rareKeys: readonly string[]): string[][] => {
  const classes: string[][] = Array.from({ length: RARE_EMBEDDED_KEY_CLASSES }, () => []);
  for (const key of new Set(rareKeys.filter(isCompilableEmbeddedKey))) {
    classes[getRareEmbeddedKeyClass(key)].push(key);
  }
  const buckets: string[][] = [];
  for (const keys of classes) {
    let bucket: string[] = [];
    let bytes = 0;
    for (const key of keys.sort(byHashThenKey)) {
      const keyBytes = getEmbeddedKeyTokenBytes(key);
      if (bucket.length >= MAX_RARE_EMBEDDED_KEYS || bytes + keyBytes > MAX_RARE_EMBEDDED_KEYS_BYTES) {
        buckets.push(bucket);
        bucket = [];
        bytes = 0;
      }
      bucket.push(key);
      bytes += keyBytes;
    }
    if (bucket.length > 0) buckets.push(bucket);
  }
  return buckets;
};

/**
 * A query names rarer embedded keys of more than one bucket. One token carries one bucket: carrying the
 * union would compile a model per combination of buckets, which dashboard picks could multiply at will.
 * The message names no key.
 */
export class RareEmbeddedKeysConflictError extends Error {
  constructor() {
    super(
      "The query uses rarely used embedded-data fields that cannot be combined in one chart. Remove one of them."
    );
    this.name = "RareEmbeddedKeysConflictError";
  }
}

/**
 * The keys a Cube token carries for `query`, in canonical order. Cube compiles one model per dataset and
 * key set (`contextToAppId`), so the set must not vary from query to query: it is the dataset's top keys,
 * and — when the query names a rarer key (a saved chart whose key grew rarer, or a dashboard filter on
 * one) — that key's whole fixed bucket, so every query naming a key of the bucket shares one model. A
 * query naming rarer keys of several buckets is refused with `RareEmbeddedKeysConflictError`.
 */
export const getEmbeddedKeysForQuery = async (
  scope: TEmbeddedKeysScope,
  query: unknown
): Promise<string[]> => {
  const topKeys = await getDatasetEmbeddedKeys(scope);
  const topMembers = new Set(topKeys.map(getEmbeddedMemberName));
  const outside = collectEmbeddedMemberNames(query).filter((member) => !topMembers.has(member));
  if (outside.length === 0) return canonicalOrder(topKeys);

  const members = await loadKeyMembers(scope, outside);
  if (!members) return canonicalOrder(topKeys);

  const top = new Set(topKeys);
  const named = new Set(outside.flatMap((member) => members[member] ?? []).filter((key) => !top.has(key)));
  if (named.size === 0) return canonicalOrder(topKeys);

  const buckets = groupRareEmbeddedKeys(Object.values(members).filter((key) => !top.has(key)));
  const chosen = buckets.filter((bucket) => bucket.some((key) => named.has(key)));
  if (chosen.length > 1) throw new RareEmbeddedKeysConflictError();
  return canonicalOrder([...topKeys, ...(chosen[0] ?? [])]);
};
