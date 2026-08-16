import "server-only";
import { performance } from "node:perf_hooks";
import { logger } from "@formbricks/logger";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import {
  type TAuthzedAuthorizationRolloutTarget,
  getAuthzedAuthorizationRolloutSurface,
} from "@/lib/authzed/rollout-contract";
import { enqueueAuthorizationComparison, getAuthorizationRolloutTarget } from "./context";
import type {
  TAuthorizationAction,
  TAuthorizationActor,
  TAuthorizationResource,
  TAuthorizationResourceForAction,
} from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
import { legacyEvaluator } from "./legacy-evaluator";
import {
  type TAuthorizationComparisonOutcome,
  type TAuthorizationDecisionLabel,
  type TAuthorizationErrorSource,
  recordAuthorizationComparison,
} from "./metrics";
import {
  type TAuthorizationRolloutConfig,
  getAuthorizationRolloutConfig,
  matchesRolloutRule,
  targetsRolloutSurface,
} from "./rollout-config";
import { type TResolvedAuthorizationScope, resolveAuthorizationScope } from "./source-scope";
import { checkSpicedbPermissionAtScope } from "./spicedb-evaluator";

const decisionLabel = (decision: boolean | undefined): TAuthorizationDecisionLabel => {
  if (decision === undefined) return "unknown";
  return decision ? "allow" : "deny";
};

const getOutcome = (legacyDecision: boolean, authzedDecision: boolean): TAuthorizationComparisonOutcome => {
  if (legacyDecision === authzedDecision) return "match";
  return legacyDecision ? "legacy_allow_authzed_deny" : "legacy_deny_authzed_allow";
};

const normalizeOperationalError = (error: unknown, operation: string): AuthzedError => {
  if (error instanceof AuthzedError) {
    return new AuthzedError({
      attempts: error.attempts,
      code: error.code,
      grpcStatus: error.grpcStatus,
      operation,
      retryable: error.retryable,
    });
  }
  return new AuthzedError({
    attempts: 1,
    code: AUTHZED_ERROR_CODES.INTERNAL,
    operation,
    retryable: false,
  });
};

type TComparisonContext<TAction extends TAuthorizationAction> = Readonly<{
  action: TAction;
  actor: TAuthorizationActor;
  cohort: string;
  mode: "enforcement" | "shadow";
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>;
  target: TAuthzedAuthorizationRolloutTarget;
}>;

const recordComparison = <TAction extends TAuthorizationAction>(
  context: TComparisonContext<TAction>,
  values: Readonly<{
    authzedDecision?: boolean;
    durationMs: number;
    error?: AuthzedError;
    errorSource?: TAuthorizationErrorSource;
    legacyDecision?: boolean;
  }>
): void => {
  const outcome = values.error
    ? "operational_error"
    : getOutcome(values.legacyDecision ?? false, values.authzedDecision ?? false);

  recordAuthorizationComparison({
    action: context.action,
    actorType: context.actor.type,
    authzedDecision: decisionLabel(values.authzedDecision),
    cohort: context.cohort,
    durationMs: values.durationMs,
    errorCode: values.error?.code,
    errorSource: values.errorSource,
    legacyDecision: decisionLabel(values.legacyDecision),
    mode: context.mode,
    outcome,
    resourceType: context.resource.type,
    surface: getAuthzedAuthorizationRolloutSurface(context.target),
  });

  if (outcome === "match") return;

  logger.warn(
    {
      action: context.action,
      actorType: context.actor.type,
      authzedDecision: decisionLabel(values.authzedDecision),
      cohort: context.cohort,
      component: "authzed",
      durationMs: values.durationMs,
      errorCode: values.error?.code,
      errorSource: values.errorSource,
      grpcStatus: values.error?.grpcStatus,
      legacyDecision: decisionLabel(values.legacyDecision),
      mode: context.mode,
      operation: "authorization_comparison",
      outcome,
      resourceType: context.resource.type,
      surface: getAuthzedAuthorizationRolloutSurface(context.target),
    },
    values.error ? "AuthZed authorization comparison failed" : "AuthZed authorization mismatch"
  );
};

const matchesRuleWithoutResolvedResource = (
  config: TAuthorizationRolloutConfig,
  mode: "enforcement" | "shadow",
  target: TAuthzedAuthorizationRolloutTarget,
  resource: TAuthorizationResource
): boolean => {
  const rule = config[mode];
  if (!targetsRolloutSurface(rule, target)) return false;
  if (rule.organizations.all) return true;
  return resource.type === "organization" && rule.organizations.ids.includes(resource.id);
};

const runShadowComparison = async <TAction extends TAuthorizationAction>(
  context: TComparisonContext<TAction>,
  config: TAuthorizationRolloutConfig,
  legacyDecision: boolean,
  resolvedScope?: TResolvedAuthorizationScope | null
): Promise<void> => {
  const startedAt = performance.now();

  try {
    const scope =
      resolvedScope === undefined
        ? await resolveAuthorizationScope(context.actor, context.resource)
        : resolvedScope;
    const selected = scope
      ? matchesRolloutRule(config.shadow, context.target, scope.organizationId)
      : matchesRuleWithoutResolvedResource(config, "shadow", context.target, context.resource);

    if (!selected) return;

    // The source-scope contract treats a missing resource as a genuine denial,
    // not an operational failure. No SpiceDB RPC is required for that result.
    const authzedDecision = scope
      ? await checkSpicedbPermissionAtScope(context.actor, context.action, context.resource, scope)
      : false;
    recordComparison(context, {
      authzedDecision,
      durationMs: Math.max(0, performance.now() - startedAt),
      legacyDecision,
    });
  } catch (error) {
    const source = error instanceof AuthzedError ? "authzed" : "source";
    recordComparison(context, {
      durationMs: Math.max(0, performance.now() - startedAt),
      error: normalizeOperationalError(error, "authorization_shadow"),
      errorSource: source,
      legacyDecision,
    });
  }
};

const queueShadowComparison = <TAction extends TAuthorizationAction>(
  context: TComparisonContext<TAction>,
  config: TAuthorizationRolloutConfig,
  legacyDecision: boolean,
  resolvedScope?: TResolvedAuthorizationScope | null
): void => {
  const queued = enqueueAuthorizationComparison(() =>
    runShadowComparison(context, config, legacyDecision, resolvedScope)
  );

  if (!queued) {
    recordComparison(context, {
      durationMs: 0,
      error: normalizeOperationalError(undefined, "authorization_scheduler"),
      errorSource: "scheduler",
      legacyDecision,
    });
  }
};

const queueLegacyComparison = <TAction extends TAuthorizationAction>(
  context: TComparisonContext<TAction>,
  authzedDecision: boolean
): void => {
  const queued = enqueueAuthorizationComparison(async () => {
    const startedAt = performance.now();
    try {
      const legacyDecision = await legacyEvaluator.can(context.actor, context.action, context.resource);
      recordComparison(context, {
        authzedDecision,
        durationMs: Math.max(0, performance.now() - startedAt),
        legacyDecision,
      });
    } catch (error) {
      recordComparison(context, {
        authzedDecision,
        durationMs: Math.max(0, performance.now() - startedAt),
        error: normalizeOperationalError(error, "authorization_legacy_comparison"),
        errorSource: "legacy",
      });
    }
  });

  if (!queued) {
    recordComparison(context, {
      authzedDecision,
      durationMs: 0,
      error: normalizeOperationalError(undefined, "authorization_scheduler"),
      errorSource: "scheduler",
    });
  }
};

export const authorizationCoordinator: AuthorizationEvaluator = {
  async can<TAction extends TAuthorizationAction>(
    actor: TAuthorizationActor,
    action: TAction,
    resource: TAuthorizationResourceForAction<NoInfer<TAction>>
  ): Promise<boolean> {
    const config = getAuthorizationRolloutConfig();
    const target = getAuthorizationRolloutTarget(actor.type);
    if (!config.enabled || !target) {
      return legacyEvaluator.can(actor, action, resource);
    }

    let resolvedScope: TResolvedAuthorizationScope | null | undefined;
    if (targetsRolloutSurface(config.enforcement, target)) {
      try {
        resolvedScope = await resolveAuthorizationScope(actor, resource);
      } catch (error) {
        const operationalError = normalizeOperationalError(error, "authorization_enforcement_scope");
        recordComparison(
          { action, actor, cohort: config.cohort, mode: "enforcement", resource, target },
          { durationMs: 0, error: operationalError, errorSource: "source" }
        );
        throw operationalError;
      }

      const selected = resolvedScope
        ? matchesRolloutRule(config.enforcement, target, resolvedScope.organizationId)
        : matchesRuleWithoutResolvedResource(config, "enforcement", target, resource);

      if (selected) {
        const context = {
          action,
          actor,
          cohort: config.cohort,
          mode: "enforcement" as const,
          resource,
          target,
        };

        let authzedDecision: boolean;
        const startedAt = performance.now();
        try {
          authzedDecision = resolvedScope
            ? await checkSpicedbPermissionAtScope(actor, action, resource, resolvedScope)
            : false;
        } catch (error) {
          const operationalError = normalizeOperationalError(error, "authorization_enforcement");
          recordComparison(context, {
            durationMs: Math.max(0, performance.now() - startedAt),
            error: operationalError,
            errorSource: error instanceof AuthzedError ? "authzed" : "source",
          });
          throw operationalError;
        }

        queueLegacyComparison(context, authzedDecision);
        return authzedDecision;
      }
    }

    const legacyDecision = await legacyEvaluator.can(actor, action, resource);
    if (targetsRolloutSurface(config.shadow, target)) {
      queueShadowComparison(
        { action, actor, cohort: config.cohort, mode: "shadow", resource, target },
        config,
        legacyDecision,
        resolvedScope
      );
    }
    return legacyDecision;
  },
};
