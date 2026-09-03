import "server-only";
import type { TAuthzedClient } from "./client";
import { deleteRelationshipsInBoundedBatches } from "./relationship-batches";

export type TOrganizationParentTarget = Readonly<{
  resourceId: string;
  resourceType: string;
}>;

/**
 * Clear every projected organization parent before the current PostgreSQL parent is restored.
 *
 * SpiceDB relations are additive, so touching a new parent cannot replace an old one. Clearing the
 * relation by resource ID removes both the current and any stale parent without needing to know the
 * previous PostgreSQL value. The caller must restore the current parent before reporting projection
 * success. Outbox revocations therefore remain pending, and authorization stays fail-closed, until
 * the complete clear-then-rebuild operation succeeds.
 */
export const deleteOrganizationParentRelationships = async (
  client: TAuthzedClient,
  targets: ReadonlyArray<TOrganizationParentTarget>
): Promise<void> => {
  await deleteRelationshipsInBoundedBatches(
    client,
    targets.map(({ resourceId, resourceType }) => ({
      relation: "organization",
      resourceId,
      resourceType,
    }))
  );
};
