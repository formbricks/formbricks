import "server-only";
import { AUTHZED_TARGET_CHUNK_SIZE } from "./constants";
import type { TAuthzedProjectionResult } from "./projection";

/**
 * Run one reconciler over chunked targets, stopping at the first chunk that does not project.
 *
 * A reconciler accepts several target lists at once and reads one PostgreSQL snapshot covering all of
 * them, so every list it understands is passed in a single call. Splitting them would multiply the
 * snapshot reads and the verification passes for no benefit.
 *
 * Chunking bounds each list independently, because each becomes its own `OR` clause in the snapshot
 * query. Call *i* takes chunk *i* of every list, so the number of calls is set by the longest list
 * rather than by their total.
 *
 * Returns `null` when every list was empty, so nothing reaches a reconciler — the write facade rejects
 * an empty update batch.
 *
 * Shared by the backfill sweep and the durable outbox: the outbox claims a bounded batch of events,
 * but a batch of user events expands into an unbounded number of membership targets, so it needs the
 * same bound.
 */
export const runChunked = async <TTargets extends Readonly<Record<string, ReadonlyArray<unknown>>>>(
  reconcile: (targets: TTargets) => Promise<TAuthzedProjectionResult>,
  targets: TTargets
): Promise<TAuthzedProjectionResult | null> => {
  type TEntry = readonly [keyof TTargets & string, ReadonlyArray<unknown>];
  const entries = (Object.entries(targets) as ReadonlyArray<TEntry>).filter(([, items]) => items.length > 0);
  if (entries.length === 0) {
    return null;
  }

  const chunkCount = Math.max(
    ...entries.map(([, items]) => Math.ceil(items.length / AUTHZED_TARGET_CHUNK_SIZE))
  );

  for (let index = 0; index < chunkCount; index++) {
    const start = index * AUTHZED_TARGET_CHUNK_SIZE;
    // Built by narrowing a full target object rather than assembling a partial one and asserting the
    // type. Every field of the reconcilers' target types is optional, so an assertion would silently
    // keep compiling if one ever became required — and the missing list would only surface at runtime.
    const chunkTargets: TTargets = { ...targets };
    for (const [key, items] of entries) {
      (chunkTargets as Record<string, ReadonlyArray<unknown>>)[key] = items.slice(
        start,
        start + AUTHZED_TARGET_CHUNK_SIZE
      );
    }

    const result = await reconcile(chunkTargets);
    if (result.status !== "projected") {
      return result;
    }
  }

  return { passes: 1, status: "projected" };
};
