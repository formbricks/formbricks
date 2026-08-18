import "server-only";
import { performance } from "node:perf_hooks";
import { logger } from "@formbricks/logger";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AuthzedError } from "@/lib/authzed/errors";
import { getAuthzedAuthorizationRolloutSurface } from "@/lib/authzed/rollout-contract";
import { normalizeAuthorizationOperationalError, toAuthorizationDecisionLabel } from "./comparison-helpers";
import {
  enqueueAuthorizationComparison,
  getAuthorizationRolloutTarget,
  recordAuthorizationCheckIssued,
} from "./context";
import type { TAuthorizationActor } from "./contract";
import {
  type TAuthorizationComparisonOutcome,
  type TAuthorizationErrorSource,
  recordAuthorizationComparison,
} from "./metrics";
import { getSpicedbObjectType } from "./object-type";
import { getWorkspaceOrganizationReferences } from "./resolvers";
import { getAuthorizationRolloutConfig, matchesRolloutRule, targetsRolloutSurface } from "./rollout-config";

export type TWorkspaceListAuthorizationObservation = Readonly<{
  actor: TAuthorizationActor;
  organizationIds: ReadonlyArray<string>;
  workspaces: ReadonlyArray<
    Readonly<{
      id: string;
      organizationId: string;
    }>
  >;
}>;

type TWorkspaceListComparisonContext = Readonly<{
  actor: TAuthorizationActor;
  actorOrganizationIds: ReadonlySet<string>;
  cohort: string;
  selectedOrganizationIds: ReadonlySet<string>;
  target: NonNullable<ReturnType<typeof getAuthorizationRolloutTarget>>;
  workspaceIds: ReadonlySet<string>;
}>;

const recordComparison = (
  context: TWorkspaceListComparisonContext,
  values: Readonly<{
    authzedDecision?: boolean;
    differenceCount?: number;
    durationMs: number;
    error?: AuthzedError;
    errorSource?: TAuthorizationErrorSource;
    legacyDecision?: boolean;
    outcome: TAuthorizationComparisonOutcome;
  }>
): void => {
  const surface = getAuthzedAuthorizationRolloutSurface(context.target);
  try {
    recordAuthorizationComparison({
      action: "workspace.read",
      actorType: context.actor.type,
      authzedDecision: toAuthorizationDecisionLabel(values.authzedDecision),
      cohort: context.cohort,
      durationMs: values.durationMs,
      errorCode: values.error?.code,
      errorSource: values.errorSource,
      legacyDecision: toAuthorizationDecisionLabel(values.legacyDecision),
      mode: "shadow",
      outcome: values.outcome,
      resourceType: "workspace",
      surface,
    });
  } catch {
    // Comparison telemetry is observational and must never alter the legacy-authoritative response or
    // prevent the remaining post-response jobs from draining.
  }

  if (values.outcome === "match") return;

  try {
    logger.warn(
      {
        action: "workspace.read",
        actorType: context.actor.type,
        authzedDecision: toAuthorizationDecisionLabel(values.authzedDecision),
        cohort: context.cohort,
        component: "authzed",
        differenceCount: values.differenceCount,
        durationMs: values.durationMs,
        errorCode: values.error?.code,
        errorSource: values.errorSource,
        grpcStatus: values.error?.grpcStatus,
        legacyDecision: toAuthorizationDecisionLabel(values.legacyDecision),
        mode: "shadow",
        operation: "workspace_list_authorization_comparison",
        outcome: values.outcome,
        resourceType: "workspace",
        surface,
      },
      values.error ? "AuthZed workspace-list comparison failed" : "AuthZed workspace-list mismatch"
    );
  } catch {
    // Logging must remain fail-safe for the same reason as metrics.
  }
};

const setDifference = (left: ReadonlySet<string>, right: ReadonlySet<string>): ReadonlySet<string> =>
  new Set([...left].filter((value) => !right.has(value)));

const runWorkspaceListComparison = async (context: TWorkspaceListComparisonContext): Promise<void> => {
  const startedAt = performance.now();

  try {
    const lookup = await getAuthzedClient().lookupResources({
      permission: "read",
      resourceType: "workspace",
      subject: {
        objectId: context.actor.id,
        objectType: getSpicedbObjectType(context.actor.type),
      },
    });
    const references = await getWorkspaceOrganizationReferences(lookup.resourceIds);
    const organizationByWorkspaceId = new Map(
      references.map(({ id, organizationId }) => [id, organizationId])
    );

    const authzedWorkspaceIds = new Set<string>();
    let unattributedAuthzedCount = 0;
    for (const workspaceId of lookup.resourceIds) {
      const organizationId = organizationByWorkspaceId.get(workspaceId);
      if (!organizationId) {
        unattributedAuthzedCount += 1;
        continue;
      }

      if (context.selectedOrganizationIds.has(organizationId)) {
        authzedWorkspaceIds.add(workspaceId);
      } else if (!context.actorOrganizationIds.has(organizationId)) {
        // A result outside the actor's PostgreSQL organizations is security-relevant cross-tenant
        // drift. A result in a real actor organization that is merely outside the selected rollout
        // cohort is intentionally ignored.
        unattributedAuthzedCount += 1;
      }
    }

    const legacyOnly = setDifference(context.workspaceIds, authzedWorkspaceIds);
    const authzedOnly = setDifference(authzedWorkspaceIds, context.workspaceIds);
    const durationMs = Math.max(0, performance.now() - startedAt);

    if (legacyOnly.size === 0 && authzedOnly.size === 0 && unattributedAuthzedCount === 0) {
      const allowed = context.workspaceIds.size > 0;
      recordComparison(context, {
        authzedDecision: allowed,
        durationMs,
        legacyDecision: allowed,
        outcome: "match",
      });
      return;
    }

    if (legacyOnly.size > 0) {
      recordComparison(context, {
        authzedDecision: false,
        differenceCount: legacyOnly.size,
        durationMs,
        legacyDecision: true,
        outcome: "legacy_allow_authzed_deny",
      });
    }

    const authzedExtraCount = authzedOnly.size + unattributedAuthzedCount;
    if (authzedExtraCount > 0) {
      recordComparison(context, {
        authzedDecision: true,
        differenceCount: authzedExtraCount,
        durationMs,
        legacyDecision: false,
        outcome: "legacy_deny_authzed_allow",
      });
    }
  } catch (error) {
    const operationalError = normalizeAuthorizationOperationalError(
      error,
      "workspace_list_authorization_shadow"
    );
    recordComparison(context, {
      durationMs: Math.max(0, performance.now() - startedAt),
      error: operationalError,
      errorSource: error instanceof AuthzedError ? "authzed" : "source",
      outcome: "operational_error",
    });
  }
};

/**
 * Observe one legacy-authoritative workspace list as one central authorization operation.
 *
 * This is intentionally a narrow Phase 1 bridge for MCP workspace discovery. It never changes the
 * returned list and does not provide a generic list or pagination abstraction; that remains ENG-1713.
 */
export const observeWorkspaceListAuthorization = (
  observation: TWorkspaceListAuthorizationObservation
): void => {
  try {
    recordAuthorizationCheckIssued();

    const config = getAuthorizationRolloutConfig();
    const target = getAuthorizationRolloutTarget(observation.actor.type);
    if (!config.enabled || !target || !targetsRolloutSurface(config.shadow, target)) return;

    const selectedOrganizationIds = new Set(
      observation.organizationIds.filter(
        (organizationId) =>
          matchesRolloutRule(config.shadow, target, organizationId) &&
          !matchesRolloutRule(config.enforcement, target, organizationId)
      )
    );
    if (selectedOrganizationIds.size === 0) return;

    const context: TWorkspaceListComparisonContext = {
      actor: Object.freeze({ ...observation.actor }),
      actorOrganizationIds: new Set(observation.organizationIds),
      cohort: config.cohort,
      selectedOrganizationIds,
      target,
      workspaceIds: new Set(
        observation.workspaces
          .filter(({ organizationId }) => selectedOrganizationIds.has(organizationId))
          .map(({ id }) => id)
      ),
    };

    if (!enqueueAuthorizationComparison(() => runWorkspaceListComparison(context))) {
      recordComparison(context, {
        durationMs: 0,
        error: normalizeAuthorizationOperationalError(undefined, "workspace_list_authorization_scheduler"),
        errorSource: "scheduler",
        outcome: "operational_error",
      });
    }
  } catch {
    // This observation is shadow-only. No scheduler/configuration/instrumentation failure may change
    // the legacy workspace list or its response status.
  }
};
