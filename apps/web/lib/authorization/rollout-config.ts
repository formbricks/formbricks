import "server-only";
import {
  type TAuthzedAuthorizationRolloutTarget,
  isAuthzedAuthorizationRolloutTarget,
} from "@/lib/authzed/rollout-contract";
import { env } from "@/lib/env";

type TOrganizationAllowlist = Readonly<{
  all: boolean;
  ids: ReadonlyArray<string>;
}>;

type TRolloutRule = Readonly<{
  organizations: TOrganizationAllowlist;
  targets: ReadonlyArray<TAuthzedAuthorizationRolloutTarget>;
}>;

export type TAuthorizationRolloutConfig = Readonly<{
  cohort: string;
  enabled: boolean;
  enforcement: TRolloutRule;
  shadow: TRolloutRule;
}>;

const parseBoolean = (value: "true" | "false" | "1" | "0" | undefined): boolean =>
  value === "true" || value === "1";

const parseTargets = (value: string | undefined): ReadonlyArray<TAuthzedAuthorizationRolloutTarget> =>
  Object.freeze(
    [
      ...new Set(
        (value ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      ),
    ].filter(isAuthzedAuthorizationRolloutTarget)
  );

const parseOrganizations = (value: string | undefined): TOrganizationAllowlist => {
  const ids = [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ];
  return Object.freeze({
    // env.ts rejects mixing `*` with explicit IDs. Keep invalid bypassed input
    // narrowed rather than silently widening it to every organization.
    all: ids.length === 1 && ids[0] === "*",
    ids: Object.freeze(ids.filter((organizationId) => organizationId !== "*")),
  });
};

export const getAuthorizationRolloutConfig = (): TAuthorizationRolloutConfig =>
  Object.freeze({
    cohort: env.AUTHZED_AUTHORIZATION_COHORT ?? "disabled",
    enabled: parseBoolean(env.AUTHZED_AUTHORIZATION_ENABLED),
    enforcement: Object.freeze({
      organizations: parseOrganizations(env.AUTHZED_ENFORCEMENT_ORGANIZATION_IDS),
      targets: parseTargets(env.AUTHZED_ENFORCEMENT_TARGETS),
    }),
    shadow: Object.freeze({
      organizations: parseOrganizations(env.AUTHZED_SHADOW_ORGANIZATION_IDS),
      targets: parseTargets(env.AUTHZED_SHADOW_TARGETS),
    }),
  });

export const matchesRolloutRule = (
  rule: TRolloutRule,
  target: TAuthzedAuthorizationRolloutTarget,
  organizationId: string
): boolean =>
  rule.targets.includes(target) &&
  (rule.organizations.all || rule.organizations.ids.includes(organizationId));

export const targetsRolloutSurface = (
  rule: TRolloutRule,
  target: TAuthzedAuthorizationRolloutTarget
): boolean => rule.targets.includes(target);
