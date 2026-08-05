import "server-only";
import { prisma } from "@formbricks/database";
import type { OrganizationRole } from "@formbricks/database/prisma";
import { type TAuthzedClient, type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { packRelationshipUpdateGroups } from "./relationship-batches";
import { ORGANIZATION_RELATIONS } from "./relationship-map";

export type { TAuthzedProjectionResult } from "./projection";

const ORGANIZATION_RELATION_NAMES = Object.values(ORGANIZATION_RELATIONS);

export type TOrganizationMembershipProjectionTarget = Readonly<{
  organizationId: string;
  userId: string;
}>;

export type TOrganizationMembershipProjectionTargets = Readonly<{
  memberships?: ReadonlyArray<TOrganizationMembershipProjectionTarget>;
}>;

type TOrganizationMembershipSnapshot = ReadonlyArray<
  Readonly<{ organizationId: string; role: OrganizationRole; userId: string }>
>;

/** Length-prefixed so `("ab", "c")` and `("a", "bc")` cannot collide. */
const pairKey = (first: string, second: string): string => `${first.length}:${first}${second}`;

const normalizeTargets = (
  targets: TOrganizationMembershipProjectionTargets
): ReadonlyArray<TOrganizationMembershipProjectionTarget> => {
  const uniqueTargets = new Map<string, TOrganizationMembershipProjectionTarget>();

  for (const target of targets.memberships ?? []) {
    uniqueTargets.set(pairKey(target.organizationId, target.userId), target);
  }

  // Deterministic ordering is what makes the snapshot comparison below a plain string equality.
  return [...uniqueTargets.values()].sort((left, right) =>
    pairKey(left.organizationId, left.userId).localeCompare(pairKey(right.organizationId, right.userId))
  );
};

const readSnapshot = async (
  targets: ReadonlyArray<TOrganizationMembershipProjectionTarget>
): Promise<TOrganizationMembershipSnapshot> =>
  prisma.membership.findMany({
    where: {
      OR: targets.map(({ organizationId, userId }) => ({ organizationId, userId })),
    },
    // The legacy evaluator does not gate organization membership on `accepted`. Project every row so
    // the initial SpiceDB shadow model preserves the current authorization behavior exactly.
    select: { organizationId: true, role: true, userId: true },
    orderBy: [{ organizationId: "asc" }, { userId: "asc" }],
  });

const snapshotsMatch = (
  left: TOrganizationMembershipSnapshot,
  right: TOrganizationMembershipSnapshot
): boolean => JSON.stringify(left) === JSON.stringify(right);

const createMembershipUpdates = (
  target: TOrganizationMembershipProjectionTarget,
  role: OrganizationRole | null
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  ORGANIZATION_RELATION_NAMES.map((relation) => ({
    operation: role !== null && relation === ORGANIZATION_RELATIONS[role] ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: target.organizationId, objectType: "organization" },
      subject: { objectId: target.userId, objectType: "user" },
    },
  }));

const writeSnapshot = async (
  client: TAuthzedClient,
  targets: ReadonlyArray<TOrganizationMembershipProjectionTarget>,
  snapshot: TOrganizationMembershipSnapshot
): Promise<void> => {
  const rolesByPair = new Map(
    snapshot.map((membership) => [pairKey(membership.organizationId, membership.userId), membership.role])
  );

  // A target with no row yields four deletes, so a membership removed outside a mutation hook — or
  // one that only ever existed in SpiceDB — is healed by being named here.
  const updateGroups = targets.map((target) => [
    ...createMembershipUpdates(
      target,
      rolesByPair.get(pairKey(target.organizationId, target.userId)) ?? null
    ),
  ]);

  for (const batch of packRelationshipUpdateGroups(updateGroups)) {
    await client.writeRelationships(batch);
  }
};

/**
 * Reconcile every named organization membership.
 *
 * Targets are explicit `(organizationId, userId)` pairs rather than a list of organizations to expand.
 * That is deliberate: expanding an organization into its current PostgreSQL memberships could only
 * ever produce targets that still exist, so a relationship present in SpiceDB with no source row
 * would never be named and never be removed. Naming pairs lets a caller feed in what it observed in
 * SpiceDB as well as what PostgreSQL holds, which is what makes stale-relationship repair possible.
 */
export const reconcileOrganizationMemberships = async (
  targets: TOrganizationMembershipProjectionTargets
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_organization_memberships", "organization_membership", async () => {
    const normalizedTargets = normalizeTargets(targets);
    // `writeRelationships` rejects an empty batch, so an empty target set must short-circuit before
    // the client is even constructed.
    if (normalizedTargets.length === 0) {
      return 0;
    }

    const client = getAuthzedClient();
    for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
      const sourceSnapshot = await readSnapshot(normalizedTargets);
      await writeSnapshot(client, normalizedTargets, sourceSnapshot);

      const verifiedSnapshot = await readSnapshot(normalizedTargets);
      if (snapshotsMatch(sourceSnapshot, verifiedSnapshot)) {
        return pass;
      }
    }

    throw new AuthzedProjectionUnstableError();
  });

/** Reconcile a single membership. Retained for the mutation-hook call sites. */
export const reconcileOrganizationMembership = async (
  organizationId: string,
  userId: string
): Promise<TAuthzedProjectionResult> =>
  reconcileOrganizationMemberships({ memberships: [{ organizationId, userId }] });

export const deleteOrganizationRelationships = async (
  organizationId: string
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("delete_organization_relationships", "organization_membership", async () => {
    await getAuthzedClient().deleteRelationships({
      resourceId: organizationId,
      resourceType: "organization",
    });
    return 1;
  });

export const deleteUserOrganizationRelationships = async (
  userId: string
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("delete_user_organization_relationships", "organization_membership", async () => {
    await getAuthzedClient().deleteRelationships({
      resourceType: "organization",
      subject: {
        objectId: userId,
        objectType: "user",
      },
    });
    return 1;
  });
