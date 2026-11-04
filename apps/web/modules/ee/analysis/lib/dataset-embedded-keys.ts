import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import type { TCubeQueryActor } from "@/modules/ee/analysis/api/lib/cube-config";
import {
  MAX_EMBEDDED_KEYS,
  MAX_EMBEDDED_KEY_LENGTH,
  collectEmbeddedMemberNames,
  selectEmbeddedKeys,
} from "./embedded-data-fields";
import { getEmbeddedMemberName } from "./embedded-member-name";

/**
 * A Feedback Dataset's embedded-data keys (ENG-6893), most frequent first. Discovery scans the whole
 * dataset (seconds on a large one), so its result is kept in Valkey and refreshed in the background once
 * it is older than `EMBEDDED_KEYS_STALE_MS`: a request reads the cached list and never waits on a scan,
 * except the very first one for a dataset, which has nothing to read yet.
 */

/** How old a key list may get before a request refreshes it in the background. */
export const EMBEDDED_KEYS_STALE_MS = 15 * 60 * 1000;
/** How long an entry is kept at all; a dataset nobody charts for a week is discovered afresh. */
const EMBEDDED_KEYS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** One refresh per dataset at a time, across every app instance. */
const EMBEDDED_KEYS_REFRESH_LOCK_MS = 2 * 60 * 1000;
/**
 * Rows discovery asks for: more than the cap, so blank, over-long and otherwise unusable keys can be
 * dropped without losing the next ones in line.
 */
const DISCOVERY_ROW_LIMIT = MAX_EMBEDDED_KEYS * 2;

export const EMBEDDED_DATA_KEY_DIMENSION = "FeedbackRecords.embeddedDataKey";

type TCachedEmbeddedKeys = { keys: string[]; refreshedAt: number };

export type TEmbeddedKeysScope = {
  datasetId: string;
  workspaceId: string;
  organizationId: string;
  actor: TCubeQueryActor;
};

const cacheKey = (datasetId: string) => createCacheKey.custom("analytics", datasetId, "embedded-keys");
const lockKey = (datasetId: string) => createCacheKey.custom("analytics", datasetId, "embedded-keys-lock");

const isCachedEmbeddedKeys = (value: unknown): value is TCachedEmbeddedKeys =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as TCachedEmbeddedKeys).keys) &&
  typeof (value as TCachedEmbeddedKeys).refreshedAt === "number";

/**
 * Ranks the dataset's keys by how many records carry them, through Cube like every other read of the
 * dataset. Imported lazily: the Cube client resolves a dataset's keys through this module.
 */
const discoverEmbeddedKeys = async (scope: TEmbeddedKeysScope): Promise<string[]> => {
  const { executeTenantScopedQuery } = await import("@/modules/ee/analysis/api/lib/cube-client");
  const rows = await executeTenantScopedQuery({
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: [EMBEDDED_DATA_KEY_DIMENSION],
      order: [
        ["FeedbackRecords.count", "desc"],
        [EMBEDDED_DATA_KEY_DIMENSION, "asc"],
      ],
      limit: DISCOVERY_ROW_LIMIT,
    },
    feedbackDirectoryId: scope.datasetId,
    workspaceId: scope.workspaceId,
    organizationId: scope.organizationId,
    actor: scope.actor,
    source: "charts.embeddedKeyDiscovery",
    // Discovery runs on the plain model: the keys are what it is finding out.
    embeddedKeys: [],
  });
  return selectEmbeddedKeys(rows.map((row) => row[EMBEDDED_DATA_KEY_DIMENSION]));
};

/** Discoveries running in this process, so a dashboard's widgets opening at once scan the dataset once. */
const inFlight = new Map<string, Promise<string[]>>();

const discoverAndStore = (scope: TEmbeddedKeysScope): Promise<string[]> => {
  const running = inFlight.get(scope.datasetId);
  if (running) return running;

  const discovery = (async () => {
    const keys = await discoverEmbeddedKeys(scope);
    const stored: TCachedEmbeddedKeys = { keys, refreshedAt: Date.now() };
    const result = await cache.set(cacheKey(scope.datasetId), stored, EMBEDDED_KEYS_TTL_MS);
    if (!result.ok) logger.warn({ datasetId: scope.datasetId }, "Could not cache a dataset's embedded keys");
    return keys;
  })().finally(() => inFlight.delete(scope.datasetId));
  inFlight.set(scope.datasetId, discovery);
  return discovery;
};

/** Refreshes a stale list unless another request already is; never throws, never awaited by a reader. */
const refreshInBackground = (scope: TEmbeddedKeysScope): void => {
  void (async () => {
    const lock = await cache.tryLock(lockKey(scope.datasetId), "1", EMBEDDED_KEYS_REFRESH_LOCK_MS);
    if (!(lock.ok && lock.data)) return;
    await discoverAndStore(scope);
  })().catch((error: unknown) => {
    logger.warn(
      { err: error, datasetId: scope.datasetId },
      "Embedded-key discovery failed; kept the old keys"
    );
  });
};

/**
 * The dataset's keys, as the Cube token names them. A failed first discovery answers no keys rather than
 * failing the chart: every chart without an embedded field still runs.
 */
export const getDatasetEmbeddedKeys = async (scope: TEmbeddedKeysScope): Promise<string[]> => {
  const cached = await cache.get<unknown>(cacheKey(scope.datasetId));
  // Without Valkey every request would rescan the dataset; charts without embedded fields still run.
  if (!cached.ok) {
    logger.warn({ datasetId: scope.datasetId }, "Cache unavailable; embedded keys are not offered");
    return [];
  }
  if (isCachedEmbeddedKeys(cached.data)) {
    if (Date.now() - cached.data.refreshedAt > EMBEDDED_KEYS_STALE_MS) refreshInBackground(scope);
    return selectEmbeddedKeys(cached.data.keys);
  }

  try {
    return await discoverAndStore(scope);
  } catch (error) {
    logger.warn({ err: error, datasetId: scope.datasetId }, "Embedded-key discovery failed");
    return [];
  }
};

/**
 * Most keys a saved query's members are looked for among, once one names a key outside the dataset's
 * top `MAX_EMBEDDED_KEYS`: such a key still exists, it is just less frequent now than when the chart was
 * built. Only the builder's catalog is capped, so a saved chart keeps working.
 */
const RESOLUTION_ROW_LIMIT = 2000;

type TCachedKeyResolution = { members: Record<string, string>; scannedAt: number };

const resolutionCacheKey = (datasetId: string) =>
  createCacheKey.custom("analytics", datasetId, "embedded-key-members");

const isCachedKeyResolution = (value: unknown): value is TCachedKeyResolution =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TCachedKeyResolution).members === "object" &&
  (value as TCachedKeyResolution).members !== null &&
  typeof (value as TCachedKeyResolution).scannedAt === "number";

/** Every key of the dataset (up to `RESOLUTION_ROW_LIMIT`), by the member it compiles to. */
const scanKeyMembers = async (scope: TEmbeddedKeysScope): Promise<Record<string, string>> => {
  const { executeTenantScopedQuery } = await import("@/modules/ee/analysis/api/lib/cube-client");
  const rows = await executeTenantScopedQuery({
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: [EMBEDDED_DATA_KEY_DIMENSION],
      order: [
        ["FeedbackRecords.count", "desc"],
        [EMBEDDED_DATA_KEY_DIMENSION, "asc"],
      ],
      limit: RESOLUTION_ROW_LIMIT,
    },
    feedbackDirectoryId: scope.datasetId,
    workspaceId: scope.workspaceId,
    organizationId: scope.organizationId,
    actor: scope.actor,
    source: "charts.embeddedKeyDiscovery",
    embeddedKeys: [],
  });
  const members: Record<string, string> = {};
  for (const row of rows) {
    const key = row[EMBEDDED_DATA_KEY_DIMENSION];
    if (typeof key !== "string" || key.trim().length === 0 || key.length > MAX_EMBEDDED_KEY_LENGTH) continue;
    members[getEmbeddedMemberName(key)] ??= key;
  }
  return members;
};

/**
 * The keys behind `memberNames`, by member: each member a key of the dataset compiles to, whether or not
 * it is among the top keys. A member no key of the dataset compiles to is left out. Looking past the top
 * keys scans the dataset once, kept in Valkey: a member still unknown after a scan younger than
 * `EMBEDDED_KEYS_STALE_MS` is not scanned for again.
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

  const cached = await cache.get<unknown>(resolutionCacheKey(scope.datasetId));
  // Without Valkey every request would rescan, so nothing past the top keys resolves, as no key does then.
  if (!cached.ok) return resolved;
  let members = isCachedKeyResolution(cached.data) ? cached.data : undefined;
  const missing = () => [...wanted].filter((member) => !resolved.has(member) && !members?.members[member]);
  if (!members || (missing().length > 0 && Date.now() - members.scannedAt > EMBEDDED_KEYS_STALE_MS)) {
    try {
      members = { members: await scanKeyMembers(scope), scannedAt: Date.now() };
      const stored = await cache.set(resolutionCacheKey(scope.datasetId), members, EMBEDDED_KEYS_TTL_MS);
      if (!stored.ok) logger.warn({ datasetId: scope.datasetId }, "Could not cache a dataset's key members");
    } catch (error) {
      logger.warn({ err: error, datasetId: scope.datasetId }, "Embedded-key resolution failed");
    }
  }
  for (const member of wanted) {
    const key = members?.members[member];
    if (!resolved.has(member) && key !== undefined) resolved.set(member, key);
  }
  return resolved;
};

/**
 * The keys a Cube token carries for `query`: the dataset's top keys, unless the query names a key outside
 * them (a saved chart whose key grew rarer, or a dashboard filter on one). Then the named keys go first and
 * the top keys fill the rest, within the token's caps, so every member the query names compiles.
 */
export const getEmbeddedKeysForQuery = async (
  scope: TEmbeddedKeysScope,
  query: unknown
): Promise<string[]> => {
  const topKeys = await getDatasetEmbeddedKeys(scope);
  const named = collectEmbeddedMemberNames(query);
  if (named.length === 0) return topKeys;

  const topMembers = new Set(topKeys.map(getEmbeddedMemberName));
  const outside = named.filter((member) => !topMembers.has(member));
  if (outside.length === 0) return topKeys;

  const resolved = await resolveEmbeddedMemberKeys(scope, named);
  const namedKeys = named.flatMap((member) => {
    const key = resolved.get(member);
    return key === undefined ? [] : [key];
  });
  return selectEmbeddedKeys([...namedKeys, ...topKeys]);
};
