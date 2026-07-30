import "server-only";
import type { TAuthzedRelationship } from "./client";
import {
  ORGANIZATION_ACCESS_RELATIONS,
  ORGANIZATION_RELATIONS,
  TEAM_RELATIONS,
  WORKSPACE_API_KEY_RELATIONS,
  WORKSPACE_TEAM_RELATIONS,
} from "./relationship-map";

/**
 * Turning observed SpiceDB relationships into reconciler targets.
 *
 * Pure and synchronous on purpose. This is where the decision that leads to a deletion is computed,
 * so it is kept free of PostgreSQL, the AuthZed facade, and I/O of any kind: it can be exhaustively
 * tested with object literals, and it cannot itself mutate anything.
 *
 * Note what this module does *not* do. It never decides that a relationship is stale. It only names
 * the source record a relationship implies, so a reconciler can look that record up in PostgreSQL and
 * decide. That indirection is what makes repair safe — a record recreated between the read and the
 * reconcile is written, not deleted.
 */

/** Resource types Formbricks projects today and may therefore reconcile. */
const MANAGED_RESOURCE_TYPES = ["api_key", "organization", "team", "workspace"] as const;

/**
 * Resource types the schema defines but no projector writes yet.
 *
 * Deliberately unprojected during the current-model migration: resource-level access is resolved
 * through PostgreSQL parent lookups instead. Reconciliation must classify these as ignored rather
 * than orphaned — pruning them would delete relationships a future projector is expected to own.
 */
const UNPROJECTED_RESOURCE_TYPES = ["dashboard", "response", "survey"] as const;

export type TAuthzedRelationshipRef = Readonly<{
  objectId: string;
  objectType: string;
  relation: string;
}>;

/**
 * A source record implied by an observed relationship.
 *
 * Named after the PostgreSQL record rather than the relationship, because that is what an operator
 * needs in order to act: "this membership has no row" is diagnosable, "this tuple looks wrong" is not.
 */
export type TAuthzedSourceRef =
  | Readonly<{ apiKeyId: string; kind: "apiKey" }>
  | Readonly<{ apiKeyId: string; kind: "apiKeyWorkspaceGrant"; workspaceId: string }>
  | Readonly<{ kind: "membership"; organizationId: string; userId: string }>
  | Readonly<{ kind: "team"; teamId: string }>
  | Readonly<{ kind: "teamMembership"; teamId: string; userId: string }>
  | Readonly<{ kind: "workspace"; workspaceId: string }>
  | Readonly<{ kind: "workspaceTeamGrant"; teamId: string; workspaceId: string }>;

export type TAuthzedObservationSummary = Readonly<{
  /** Relationships on deliberately-unprojected resource types. Counted, never acted on. */
  ignored: number;
  /** Deduplicated, deterministically ordered source records the observation implies. */
  sourceRefs: ReadonlyArray<TAuthzedSourceRef>;
  /**
   * Relationships this vocabulary does not recognize.
   *
   * Something other than Formbricks writing to this SpiceDB, or a schema change that landed without a
   * matching projector. Reported so it is visible; never reconciled and never pruned, because the
   * tooling cannot know what source record — if any — should own them.
   */
  unmanaged: ReadonlyArray<TAuthzedRelationshipRef>;
}>;

const ORGANIZATION_ROLE_RELATIONS = new Set<string>(Object.values(ORGANIZATION_RELATIONS));
const ORGANIZATION_API_KEY_RELATIONS = new Set<string>(Object.values(ORGANIZATION_ACCESS_RELATIONS));
const TEAM_ROLE_RELATIONS = new Set<string>(Object.values(TEAM_RELATIONS));
const WORKSPACE_TEAM_GRANT_RELATIONS = new Set<string>(Object.values(WORKSPACE_TEAM_RELATIONS));
const WORKSPACE_API_KEY_GRANT_RELATIONS = new Set<string>(Object.values(WORKSPACE_API_KEY_RELATIONS));

/** The relation naming a resource's owning organization, shared by `api_key`, `team`, and `workspace`. */
const PARENT_RELATION = "organization";

export const isManagedResourceType = (resourceType: string): boolean =>
  (MANAGED_RESOURCE_TYPES as readonly string[]).includes(resourceType);

export const isUnprojectedResourceType = (resourceType: string): boolean =>
  (UNPROJECTED_RESOURCE_TYPES as readonly string[]).includes(resourceType);

export const getManagedResourceTypes = (): ReadonlyArray<string> => MANAGED_RESOURCE_TYPES;

/**
 * Name the source record an observed relationship implies, or `null` if the vocabulary does not
 * recognize it.
 *
 * Both the relation name and the subject type matter. `workspace#reader@api_key` and
 * `workspace#reader_team@team#member` are distinct grants, and the API-key relations are deliberately
 * unsuffixed while the team relations are not.
 */
export const toSourceRef = (relationship: TAuthzedRelationship): TAuthzedSourceRef | null => {
  const { relation, resource, subject } = relationship;

  switch (resource.objectType) {
    case "organization":
      if (subject.objectType === "user" && ORGANIZATION_ROLE_RELATIONS.has(relation)) {
        return { kind: "membership", organizationId: resource.objectId, userId: subject.objectId };
      }
      if (subject.objectType === "api_key" && ORGANIZATION_API_KEY_RELATIONS.has(relation)) {
        // Access flags live on the key's own record, so the key is the thing to look up.
        return { apiKeyId: subject.objectId, kind: "apiKey" };
      }
      return null;

    case "team":
      if (subject.objectType === "organization" && relation === PARENT_RELATION) {
        return { kind: "team", teamId: resource.objectId };
      }
      if (subject.objectType === "user" && TEAM_ROLE_RELATIONS.has(relation)) {
        return { kind: "teamMembership", teamId: resource.objectId, userId: subject.objectId };
      }
      return null;

    case "workspace":
      if (subject.objectType === "organization" && relation === PARENT_RELATION) {
        return { kind: "workspace", workspaceId: resource.objectId };
      }
      if (subject.objectType === "team" && WORKSPACE_TEAM_GRANT_RELATIONS.has(relation)) {
        return { kind: "workspaceTeamGrant", teamId: subject.objectId, workspaceId: resource.objectId };
      }
      if (subject.objectType === "api_key" && WORKSPACE_API_KEY_GRANT_RELATIONS.has(relation)) {
        return {
          apiKeyId: subject.objectId,
          kind: "apiKeyWorkspaceGrant",
          workspaceId: resource.objectId,
        };
      }
      return null;

    case "api_key":
      if (subject.objectType === "organization" && relation === PARENT_RELATION) {
        return { apiKeyId: resource.objectId, kind: "apiKey" };
      }
      return null;

    default:
      return null;
  }
};

/** Stable identity for deduplication and ordering. Field order is fixed by the union's key order. */
const sourceRefKey = (ref: TAuthzedSourceRef): string => JSON.stringify(ref);

const toRelationshipRef = (relationship: TAuthzedRelationship): TAuthzedRelationshipRef => ({
  objectId: relationship.resource.objectId,
  objectType: relationship.resource.objectType,
  relation: relationship.relation,
});

/**
 * Classify an observation and collect the source records it implies.
 *
 * Deduplicated and deterministically ordered so a run is reproducible and two runs over unchanged
 * state produce identical output.
 */
export const summarizeObservation = (
  relationships: ReadonlyArray<TAuthzedRelationship>
): TAuthzedObservationSummary => {
  const sourceRefs = new Map<string, TAuthzedSourceRef>();
  const unmanaged = new Map<string, TAuthzedRelationshipRef>();
  let ignored = 0;

  for (const relationship of relationships) {
    if (isUnprojectedResourceType(relationship.resource.objectType)) {
      ignored++;
      continue;
    }

    const sourceRef = toSourceRef(relationship);
    if (sourceRef) {
      sourceRefs.set(sourceRefKey(sourceRef), sourceRef);
      continue;
    }

    const ref = toRelationshipRef(relationship);
    unmanaged.set(JSON.stringify(ref), ref);
  }

  return {
    ignored,
    sourceRefs: [...sourceRefs.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, ref]) => ref),
    unmanaged: [...unmanaged.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, ref]) => ref),
  };
};
