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

export type TApiKeyProjectionTargets = Readonly<{
  apiKeyIds?: ReadonlyArray<string>;
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

const normalizeTargets = (targets: TApiKeyProjectionTargets): ReadonlyArray<string> =>
  [...new Set(targets.apiKeyIds ?? [])].sort((left, right) => left.localeCompare(right));

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
    const apiKeyIds = normalizeTargets(targets);
    if (apiKeyIds.length === 0) {
      return 0;
    }

    // Workspace scopes are immutable today, so current snapshots contain every workspace that needs
    // reconciliation. If scope removal is added, callers must also target pre-change workspace IDs
    // so stale subject-side grants are deleted.
    const observedWorkspaceIds = new Map(apiKeyIds.map((apiKeyId) => [apiKeyId, new Set<string>()]));

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
