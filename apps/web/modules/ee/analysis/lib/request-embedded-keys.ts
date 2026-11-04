import "server-only";
import { type TEmbeddedKeysScope, getEmbeddedKeysForQuery } from "./dataset-embedded-keys";
import { collectEmbeddedMemberNames } from "./embedded-data-fields";

/**
 * The embedded-data keys for each Cube token one request makes, resolved once per dataset and set of
 * named embedded fields. A request that runs many queries on one dataset — a dashboard filter's value
 * list runs up to 40 — would otherwise read the dataset's key list from Valkey for every query, though
 * every one of them gets the same keys. Lives as long as the request: nothing carries to the next one.
 */
export const createRequestEmbeddedKeys = (scopeOf: (datasetId: string) => TEmbeddedKeysScope) => {
  const resolved = new Map<string, Promise<string[]>>();
  return (datasetId: string, query: unknown): Promise<string[]> => {
    const members = [...new Set(collectEmbeddedMemberNames(query))].sort();
    const key = JSON.stringify([datasetId, members]);
    let keys = resolved.get(key);
    if (!keys) {
      keys = getEmbeddedKeysForQuery(scopeOf(datasetId), query);
      resolved.set(key, keys);
    }
    return keys;
  };
};
