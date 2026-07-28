import "server-only";
import { prisma } from "@formbricks/database";
import { OrganizationRole } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";

const ORGANIZATION_RELATIONS = {
  [OrganizationRole.billing]: "billing",
  [OrganizationRole.manager]: "manager",
  [OrganizationRole.member]: "member",
  [OrganizationRole.owner]: "owner",
} as const satisfies Record<OrganizationRole, string>;

const ORGANIZATION_RELATION_NAMES = Object.values(ORGANIZATION_RELATIONS);
const MAX_RECONCILIATION_PASSES = 3;

type TOrganizationProjectionOperation =
  | "delete_organization_relationships"
  | "delete_user_organization_relationships"
  | "reconcile_organization_membership";

type TAuthzedProjectionErrorCode = TAuthzedErrorCode | "authzed_projection_unstable";

class AuthzedProjectionUnstableError extends Error {
  readonly attempts = MAX_RECONCILIATION_PASSES;
  readonly code = "authzed_projection_unstable";
  readonly retryable = false;
}

export type TAuthzedProjectionResult =
  | Readonly<{ status: "disabled" }>
  | Readonly<{ passes: number; status: "projected" }>
  | Readonly<{
      attempts: number;
      code: TAuthzedProjectionErrorCode;
      retryable: boolean;
      status: "failed";
    }>;

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

const getProjectionError = (
  error: unknown,
  operation: TOrganizationProjectionOperation
): Readonly<{
  attempts: number;
  code: TAuthzedProjectionErrorCode;
  retryable: boolean;
}> => {
  if (error instanceof AuthzedProjectionUnstableError) {
    return error;
  }

  const attempts = error instanceof AuthzedError ? error.attempts : 1;
  return mapAuthzedError(error, operation, attempts);
};

const logProjectionFailure = (
  operation: TOrganizationProjectionOperation,
  error: Readonly<{
    attempts: number;
    code: TAuthzedProjectionErrorCode;
    retryable: boolean;
  }>,
  durationMs: number
): void => {
  logger.warn(
    {
      attempts: error.attempts,
      component: "authzed",
      durationMs,
      errorCode: error.code,
      operation,
      projection: "organization_membership",
      retryable: error.retryable,
    },
    "AuthZed relationship projection failed"
  );
};

const runBestEffortProjection = async (
  operation: TOrganizationProjectionOperation,
  projection: () => Promise<number>
): Promise<TAuthzedProjectionResult> => {
  if (!isAuthzedEnabled()) {
    return { status: "disabled" };
  }

  const startedAt = performance.now();

  try {
    const passes = await projection();
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    logger.debug(
      {
        component: "authzed",
        durationMs,
        operation,
        passes,
        projection: "organization_membership",
        status: "projected",
      },
      "AuthZed relationship projection completed"
    );

    return { passes, status: "projected" };
  } catch (error) {
    const mappedError = getProjectionError(error, operation);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    const result = {
      attempts: mappedError.attempts,
      code: mappedError.code,
      retryable: mappedError.retryable,
      status: "failed" as const,
    };

    logProjectionFailure(operation, result, durationMs);
    return result;
  }
};

export const reconcileOrganizationMembership = async (
  organizationId: string,
  userId: string
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_organization_membership", async () => {
    const client = getAuthzedClient();

    for (let pass = 1; pass <= MAX_RECONCILIATION_PASSES; pass++) {
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
  runBestEffortProjection("delete_organization_relationships", async () => {
    await getAuthzedClient().deleteRelationships({
      resourceId: organizationId,
      resourceType: "organization",
    });
    return 1;
  });

export const deleteUserOrganizationRelationships = async (
  userId: string
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("delete_user_organization_relationships", async () => {
    await getAuthzedClient().deleteRelationships({
      resourceType: "organization",
      subject: {
        objectId: userId,
        objectType: "user",
      },
    });
    return 1;
  });
