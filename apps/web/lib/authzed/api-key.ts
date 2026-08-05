import "server-only";
import { prisma } from "@formbricks/database";
import type { ApiKeyPermission } from "@formbricks/database/prisma";
import { type TAuthzedRelationshipFilter, type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { deleteRelationshipsInBoundedBatches, packRelationshipUpdateGroups } from "./relationship-batches";
import {
  ORGANIZATION_ACCESS_RELATIONS,
  type TOrganizationAccessSnapshot,
  WORKSPACE_API_KEY_RELATIONS as WORKSPACE_RELATIONS,
  normalizeOrganizationAccess,
} from "./relationship-map";

const WORKSPACE_RELATION_NAMES = Object.values(WORKSPACE_RELATIONS);

export type TApiKeyWorkspaceProjectionTarget = Readonly<{
  apiKeyId: string;
  workspaceId: string;
}>;

export type TApiKeyProjectionTargets = Readonly<{
  apiKeyIds?: ReadonlyArray<string>;
  /**
   * Workspace scopes to reconcile even if PostgreSQL no longer grants them.
   *
   * Workspace targets are otherwise discovered from the key's current grants, so a scope revoked
   * outside a mutation hook leaves an unreachable relationship: it is absent from the snapshot, so
   * nothing names it, so nothing deletes it. Naming a pair here seeds it as a target, and an absent
   * grant then deletes all three workspace relations. Each named key is implied as a target.
   */
  apiKeyWorkspaceGrants?: ReadonlyArray<TApiKeyWorkspaceProjectionTarget>;
}>;

type TApiKeyWorkspaceSnapshot = Readonly<{
  permission: ApiKeyPermission;
  workspaceId: string;
}>;

type TApiKeySnapshot = ReadonlyArray<
  Readonly<{
    apiKeyWorkspaces: ReadonlyArray<TApiKeyWorkspaceSnapshot>;
    id: string;
    organizationAccess: TOrganizationAccessSnapshot;
    organizationId: string;
  }>
>;

type TNormalizedTargets = Readonly<{
  apiKeyIds: ReadonlyArray<string>;
  /** Workspace IDs to reconcile per API key, independent of what the source snapshot grants. */
  seededWorkspaceIds: ReadonlyMap<string, ReadonlySet<string>>;
}>;

const normalizeTargets = (targets: TApiKeyProjectionTargets): TNormalizedTargets => {
  const apiKeyIds = new Set(targets.apiKeyIds ?? []);
  const seededWorkspaceIds = new Map<string, Set<string>>();

  for (const { apiKeyId, workspaceId } of targets.apiKeyWorkspaceGrants ?? []) {
    // A named grant implies its key, so a caller repairing one stale scope need not also list the key.
    apiKeyIds.add(apiKeyId);
    const workspaceIds = seededWorkspaceIds.get(apiKeyId) ?? new Set<string>();
    workspaceIds.add(workspaceId);
    seededWorkspaceIds.set(apiKeyId, workspaceIds);
  }

  return {
    apiKeyIds: [...apiKeyIds].sort((left, right) => left.localeCompare(right)),
    seededWorkspaceIds,
  };
};

const readSnapshot = async (apiKeyIds: ReadonlyArray<string>): Promise<TApiKeySnapshot> => {
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      id: {
        in: [...apiKeyIds],
      },
    },
    select: {
      apiKeyWorkspaces: {
        select: {
          permission: true,
          workspaceId: true,
        },
        orderBy: {
          workspaceId: "asc",
        },
      },
      id: true,
      organizationAccess: true,
      organizationId: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return apiKeys.map((apiKey) => ({
    apiKeyWorkspaces: apiKey.apiKeyWorkspaces,
    id: apiKey.id,
    organizationAccess: normalizeOrganizationAccess(apiKey.organizationAccess),
    organizationId: apiKey.organizationId,
  }));
};

const snapshotsMatch = (left: TApiKeySnapshot, right: TApiKeySnapshot): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const createParentUpdate = (apiKeyId: string, organizationId: string): TAuthzedRelationshipUpdate => ({
  operation: "touch",
  relationship: {
    relation: "organization",
    resource: { objectId: apiKeyId, objectType: "api_key" },
    subject: { objectId: organizationId, objectType: "organization" },
  },
});

const createOrganizationAccessUpdates = (
  apiKeyId: string,
  organizationId: string,
  organizationAccess: TOrganizationAccessSnapshot
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  (Object.keys(ORGANIZATION_ACCESS_RELATIONS) as ReadonlyArray<keyof TOrganizationAccessSnapshot>).map(
    (permission) => ({
      operation: organizationAccess[permission] ? "touch" : "delete",
      relationship: {
        relation: ORGANIZATION_ACCESS_RELATIONS[permission],
        resource: { objectId: organizationId, objectType: "organization" },
        subject: { objectId: apiKeyId, objectType: "api_key" },
      },
    })
  );

const createWorkspaceUpdates = (
  apiKeyId: string,
  workspaceId: string,
  permission: ApiKeyPermission | null
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  WORKSPACE_RELATION_NAMES.map((relation) => ({
    operation: permission !== null && relation === WORKSPACE_RELATIONS[permission] ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: workspaceId, objectType: "workspace" },
      subject: { objectId: apiKeyId, objectType: "api_key" },
    },
  }));

const addObservedWorkspaceTargets = (
  observedWorkspaceIds: Map<string, Set<string>>,
  snapshot: TApiKeySnapshot
): void => {
  for (const apiKey of snapshot) {
    const workspaceIds = observedWorkspaceIds.get(apiKey.id);
    if (!workspaceIds) {
      continue;
    }

    for (const grant of apiKey.apiKeyWorkspaces) {
      workspaceIds.add(grant.workspaceId);
    }
  }
};

const writeSnapshot = async (
  apiKeyIds: ReadonlyArray<string>,
  snapshot: TApiKeySnapshot,
  observedWorkspaceIds: ReadonlyMap<string, ReadonlySet<string>>
): Promise<void> => {
  const client = getAuthzedClient();
  const apiKeysById = new Map(snapshot.map((apiKey) => [apiKey.id, apiKey]));
  const updateGroups: TAuthzedRelationshipUpdate[][] = [];

  for (const apiKey of snapshot) {
    updateGroups.push([createParentUpdate(apiKey.id, apiKey.organizationId)]);
    updateGroups.push([
      ...createOrganizationAccessUpdates(apiKey.id, apiKey.organizationId, apiKey.organizationAccess),
    ]);

    const currentGrants = new Map(
      apiKey.apiKeyWorkspaces.map((grant) => [grant.workspaceId, grant.permission])
    );
    const workspaceIds = [...(observedWorkspaceIds.get(apiKey.id) ?? [])].sort((left, right) =>
      left.localeCompare(right)
    );

    for (const workspaceId of workspaceIds) {
      updateGroups.push([
        ...createWorkspaceUpdates(apiKey.id, workspaceId, currentGrants.get(workspaceId) ?? null),
      ]);
    }
  }

  for (const batch of packRelationshipUpdateGroups(updateGroups)) {
    await client.writeRelationships(batch);
  }

  const deletionFilters: TAuthzedRelationshipFilter[] = [];
  for (const apiKeyId of apiKeyIds) {
    if (apiKeysById.has(apiKeyId)) {
      continue;
    }

    deletionFilters.push({ resourceId: apiKeyId, resourceType: "api_key" });
    deletionFilters.push({
      resourceType: "organization",
      subject: { objectId: apiKeyId, objectType: "api_key" },
    });
    deletionFilters.push({
      resourceType: "workspace",
      subject: { objectId: apiKeyId, objectType: "api_key" },
    });
  }

  await deleteRelationshipsInBoundedBatches(client, deletionFilters);
};

export const reconcileApiKeyRelationships = async (
  targets: TApiKeyProjectionTargets
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_api_key_relationships", "api_key", async () => {
    const { apiKeyIds, seededWorkspaceIds } = normalizeTargets(targets);
    if (apiKeyIds.length === 0) {
      return 0;
    }

    // Workspace scopes are immutable today, so a current snapshot contains every workspace a normal
    // projection needs. A scope that disappeared anyway — removed outside a mutation hook, or by a
    // future edit path — is invisible to the snapshot, which is what `apiKeyWorkspaceGrants` is for:
    // seeded targets are reconciled regardless, then extended by whatever each pass observes.
    const observedWorkspaceIds = new Map(
      apiKeyIds.map((apiKeyId) => [apiKeyId, new Set<string>(seededWorkspaceIds.get(apiKeyId) ?? [])])
    );

    for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
      const sourceSnapshot = await readSnapshot(apiKeyIds);
      addObservedWorkspaceTargets(observedWorkspaceIds, sourceSnapshot);
      await writeSnapshot(apiKeyIds, sourceSnapshot, observedWorkspaceIds);

      const verifiedSnapshot = await readSnapshot(apiKeyIds);
      if (snapshotsMatch(sourceSnapshot, verifiedSnapshot)) {
        return pass;
      }
    }

    throw new AuthzedProjectionUnstableError();
  });
