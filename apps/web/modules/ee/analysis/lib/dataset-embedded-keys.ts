import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import type { TCubeQueryActor } from "@/modules/ee/analysis/api/lib/cube-config";
import { MAX_EMBEDDED_KEYS, selectEmbeddedKeys } from "./embedded-data-fields";

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
