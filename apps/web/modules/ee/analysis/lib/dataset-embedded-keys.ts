import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { loggableError } from "@/lib/utils/loggable-error";
import type { TCubeQueryActor } from "@/modules/ee/analysis/api/lib/cube-config";
import {
  MAX_EMBEDDED_KEYS,
  MAX_RARE_EMBEDDED_KEYS,
  MAX_RARE_EMBEDDED_KEYS_CHARS,
  collectEmbeddedMemberNames,
  getEmbeddedKeyTokenChars,
  isCompilableEmbeddedKey,
  selectEmbeddedKeys,
} from "./embedded-data-fields";
import { getEmbeddedMemberName } from "./embedded-member-name";

/**
 * A Feedback Dataset's embedded-data keys (ENG-6893). Both reads below scan the whole dataset (seconds on
 * a large one), so each result is kept in Valkey and refreshed in the background once it is older than
 * `EMBEDDED_KEYS_STALE_MS`, under a lock across app instances: a request answers from what is cached and
 * never waits on a rescan. Only a dataset's very first scan is awaited, once per process however many
 * widgets ask at once, and a failed scan is remembered for `FAILED_SCAN_RETRY_MS` so requests do not
 * rescan a dataset Cube cannot answer for (C4).
 */

/** How old a scan may get before a request refreshes it in the background. */
export const EMBEDDED_KEYS_STALE_MS = 15 * 60 * 1000;
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

const discoverAndStore = (scope: TEmbeddedKeysScope): Promise<string[]> =>
  runOnce(keysCacheKey(scope.datasetId), async () => {
    const keys = selectEmbeddedKeys(await scanRankedKeys(scope, DISCOVERY_ROW_LIMIT));
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
      refreshInBackground(keysLockKey(scope.datasetId), scope.datasetId, () => discoverAndStore(scope));
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

/** The order every token lists its keys in, the same as cube.js `getEmbeddedKeys` sorts them. */
const canonicalOrder = (keys: readonly string[]): string[] => [...keys].sort();

/** The member-name hash of a key: spreads keys evenly and never changes for a key. */
const keyHash = (key: string): string => getEmbeddedMemberName(key).slice(-8);

/**
 * The fixed buckets a dataset's rarer keys fall into (S5): the keys ordered by their member hash, cut into
 * runs of at most `MAX_RARE_EMBEDDED_KEYS` keys and `MAX_RARE_EMBEDDED_KEYS_CHARS` token characters. The
 * same keys always make the same buckets, whatever order they come in.
 */
export const groupRareEmbeddedKeys = (rareKeys: readonly string[]): string[][] => {
  const ordered = [...new Set(rareKeys.filter(isCompilableEmbeddedKey))].sort((a, b) => {
    const byHash = keyHash(a).localeCompare(keyHash(b));
    if (byHash !== 0) return byHash;
    if (a === b) return 0;
    return a < b ? -1 : 1;
  });
  const buckets: string[][] = [];
  let bucket: string[] = [];
  let chars = 0;
  for (const key of ordered) {
    const keyChars = getEmbeddedKeyTokenChars(key);
    if (bucket.length >= MAX_RARE_EMBEDDED_KEYS || chars + keyChars > MAX_RARE_EMBEDDED_KEYS_CHARS) {
      buckets.push(bucket);
      bucket = [];
      chars = 0;
    }
    bucket.push(key);
    chars += keyChars;
  }
  if (bucket.length > 0) buckets.push(bucket);
  return buckets;
};

/**
 * The keys a Cube token carries for `query`, in canonical order. Cube compiles one model per dataset and
 * key set (`contextToAppId`), so the set must not vary from query to query (S5): it is the dataset's top
 * keys, and — when the query names a rarer key (a saved chart whose key grew rarer, or a dashboard filter
 * on one) — that key's whole fixed bucket, so every query naming a key of the bucket shares one model. A
 * query naming rarer keys of several buckets carries just its own rarer keys, within the same caps.
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
  const namedRare = [
    ...new Set(outside.flatMap((member) => members[member] ?? []).filter((key) => !top.has(key))),
  ];
  if (namedRare.length === 0) return canonicalOrder(topKeys);

  const buckets = groupRareEmbeddedKeys(Object.values(members).filter((key) => !top.has(key)));
  const named = new Set(namedRare);
  const chosen = buckets.filter((bucket) => bucket.some((key) => named.has(key)));
  const rare =
    chosen.length === 1
      ? chosen[0]
      : selectEmbeddedKeys(canonicalOrder(namedRare), {
          maxKeys: MAX_RARE_EMBEDDED_KEYS,
          maxChars: MAX_RARE_EMBEDDED_KEYS_CHARS,
        });
  return canonicalOrder([...topKeys, ...rare]);
};
