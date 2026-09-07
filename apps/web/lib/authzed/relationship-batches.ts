import "server-only";
import type { TAuthzedClient, TAuthzedRelationshipFilter, TAuthzedRelationshipUpdate } from "./client";
import { AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES, AUTHZED_MAX_RELATIONSHIP_UPDATES } from "./constants";

export const packRelationshipUpdateGroups = (
  groups: ReadonlyArray<ReadonlyArray<TAuthzedRelationshipUpdate>>
): ReadonlyArray<ReadonlyArray<TAuthzedRelationshipUpdate>> => {
  const batches: TAuthzedRelationshipUpdate[][] = [];
  let batch: TAuthzedRelationshipUpdate[] = [];

  for (const group of groups) {
    if (group.length > AUTHZED_MAX_RELATIONSHIP_UPDATES) {
      throw new Error("AuthZed relationship update group exceeds the maximum batch size");
    }

    if (batch.length > 0 && batch.length + group.length > AUTHZED_MAX_RELATIONSHIP_UPDATES) {
      batches.push(batch);
      batch = [];
    }
    batch.push(...group);
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  return batches;
};

export const deleteRelationshipsInBoundedBatches = async (
  client: TAuthzedClient,
  filters: ReadonlyArray<TAuthzedRelationshipFilter>
): Promise<void> => {
  for (let start = 0; start < filters.length; start += AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES) {
    await Promise.all(
      filters
        .slice(start, start + AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES)
        .map((filter) => client.deleteRelationships(filter))
    );
  }
};
