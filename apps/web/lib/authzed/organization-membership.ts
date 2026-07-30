import "server-only";
import { prisma } from "@formbricks/database";
import type { OrganizationRole } from "@formbricks/database/prisma";
import { getAuthzedClient } from "./client";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { ORGANIZATION_RELATIONS } from "./relationship-map";

export type { TAuthzedProjectionResult } from "./projection";

const ORGANIZATION_RELATION_NAMES = Object.values(ORGANIZATION_RELATIONS);
type TOrganizationMembershipState = OrganizationRole | null;

const getOrganizationMembershipState = async (
  organizationId: string,
  userId: string
): Promise<TOrganizationMembershipState> => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        organizationId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  // The legacy evaluator does not gate organization membership on `accepted`. Project every row so
  // the initial SpiceDB shadow model preserves the current authorization behavior exactly.
  return membership?.role ?? null;
};

export const reconcileOrganizationMembership = async (
  organizationId: string,
  userId: string
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_organization_membership", "organization_membership", async () => {
    const client = getAuthzedClient();

    for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
      const sourceRole = await getOrganizationMembershipState(organizationId, userId);

      await client.writeRelationships(
        ORGANIZATION_RELATION_NAMES.map((relation) => ({
          operation:
            sourceRole !== null && relation === ORGANIZATION_RELATIONS[sourceRole] ? "touch" : "delete",
          relationship: {
            relation,
            resource: {
              objectId: organizationId,
              objectType: "organization",
            },
            subject: {
              objectId: userId,
              objectType: "user",
            },
          },
        }))
      );

      const verifiedRole = await getOrganizationMembershipState(organizationId, userId);
      if (verifiedRole === sourceRole) {
        return pass;
      }
    }

    throw new AuthzedProjectionUnstableError();
  });

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
