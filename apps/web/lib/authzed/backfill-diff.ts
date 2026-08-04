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
  /** Every parent edge observed, so the organization each resource claims can be verified. */
  parentEdges: ReadonlyArray<TAuthzedParentEdge>;
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

export const isUnprojectedResourceType = (resourceType: string): boolean =>
  (UNPROJECTED_RESOURCE_TYPES as readonly string[]).includes(resourceType);

/**
 * Resolves the source record a relationship on one resource type implies, or `null` when the
 * vocabulary does not recognize that particular relation/subject pairing.
 */
type TSourceRefResolver = (relationship: TAuthzedRelationship) => TAuthzedSourceRef | null;

const toOrganizationSourceRef: TSourceRefResolver = ({ relation, resource, subject }) => {
  if (subject.objectType === "user" && ORGANIZATION_ROLE_RELATIONS.has(relation)) {
    return { kind: "membership", organizationId: resource.objectId, userId: subject.objectId };
  }
  if (subject.objectType === "api_key" && ORGANIZATION_API_KEY_RELATIONS.has(relation)) {
    // Access flags live on the key's own record, so the key is the thing to look up.
    return { apiKeyId: subject.objectId, kind: "apiKey" };
  }

  return null;
};

const toTeamSourceRef: TSourceRefResolver = ({ relation, resource, subject }) => {
  if (subject.objectType === "organization" && relation === PARENT_RELATION) {
    return { kind: "team", teamId: resource.objectId };
  }
  if (subject.objectType === "user" && TEAM_ROLE_RELATIONS.has(relation)) {
    return { kind: "teamMembership", teamId: resource.objectId, userId: subject.objectId };
  }

  return null;
};

const toWorkspaceSourceRef: TSourceRefResolver = ({ relation, resource, subject }) => {
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
};

const toApiKeySourceRef: TSourceRefResolver = ({ relation, resource, subject }) =>
  subject.objectType === "organization" && relation === PARENT_RELATION
    ? { apiKeyId: resource.objectId, kind: "apiKey" }
    : null;

/**
 * The vocabulary in one table: which resource types imply a source record, and how.
 *
 * `MANAGED_RESOURCE_TYPES` is derived from these keys rather than listed separately, so a resource
 * type can never be swept without a resolver that knows how to interpret what the sweep finds.
 *
 * Both the relation name and the subject type matter in every resolver. `workspace#reader@api_key`
 * and `workspace#reader_team@team#member` are distinct grants, and the API-key relations are
 * deliberately unsuffixed while the team relations are not.
 */
const SOURCE_REF_RESOLVERS = {
  api_key: toApiKeySourceRef,
  organization: toOrganizationSourceRef,
  team: toTeamSourceRef,
  workspace: toWorkspaceSourceRef,
} as const satisfies Readonly<Record<string, TSourceRefResolver>>;

/**
 * Code-unit order, deliberately not `localeCompare`.
 *
 * `localeCompare` resolves its collation from the host's default locale and available ICU data, so two
 * machines can order the same keys differently — which would undercut the very guarantee this sort
 * exists to provide.
 */
const byCodeUnit = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
};

/**
 * Resource types Formbricks projects today and may therefore reconcile.
 *
 * Sorted explicitly for two reasons: the sweep's order must not depend on how the resolver literal above
 * happens to be written, and it must be identical on every machine, so two passes over unchanged state
 * produce identical output.
 */
const MANAGED_RESOURCE_TYPES: ReadonlyArray<string> = Object.keys(SOURCE_REF_RESOLVERS).sort(byCodeUnit);

export const getManagedResourceTypes = (): ReadonlyArray<string> => MANAGED_RESOURCE_TYPES;

/** Name the source record an observed relationship implies, or `null` if it names none. */
export const toSourceRef = (relationship: TAuthzedRelationship): TAuthzedSourceRef | null => {
  const resolve: TSourceRefResolver | undefined =
    SOURCE_REF_RESOLVERS[relationship.resource.objectType as keyof typeof SOURCE_REF_RESOLVERS];

  return resolve?.(relationship) ?? null;
};

/**
 * An observed parent edge: a resource claiming to belong to an organization.
 *
 * Tracked separately from the source records because the organization on the *right* of the edge is
 * information a source-record reference throws away. `team:T#organization@organization:O` implies
 * "Team T exists", and an existence check confirms that even when `O` is the wrong organization —
 * so without this the edge is invisible.
 *
 * It matters because `organization` is a SpiceDB relation, i.e. a set, and the schema grants
 * `workspace#manage` through `organization->manage`. A second, wrong parent edge on a workspace therefore
 * hands every owner and manager of that organization full access to another tenant's workspace, with
 * nothing in PostgreSQL to show for it.
 */
export type TAuthzedParentEdge = Readonly<{
  childId: string;
  childType: "api_key" | "team" | "workspace";
  organizationId: string;
}>;

/** Stable identity for deduplication and ordering. Field order is fixed by the union's key order. */
/**
 * A stable identity for one source record, used to deduplicate and to diff.
 *
 * `JSON.stringify` over a literal whose keys are written in a fixed order in `toSourceRef` and
 * `toSourceRefs`. Two refs for the same record must serialize identically, so both constructors keep
 * their key order aligned — the test asserting round-trip equality of every kind is what holds that.
 */
export const sourceRefKey = (ref: TAuthzedSourceRef): string => JSON.stringify(ref);

/** The parent edge an observed relationship asserts, if it asserts one. */
const toParentEdge = (relationship: TAuthzedRelationship): TAuthzedParentEdge | null => {
  const { relation, resource, subject } = relationship;

  // Two relationship shapes state the same fact — "this API key belongs to that organization" — and both
  // have to be verified against PostgreSQL:
  //
  //   api_key:K      # organization    @ organization:A    the key's own parent edge
  //   organization:A # api_key_writer  @ api_key:K         an organization-level access grant
  //
  // The second reduces to `{kind: "apiKey"}` as a source ref, which only asks "does K exist?" — true
  // whenever K exists under *any* organization. So a grant naming a foreign key read as sourced, survived
  // apply and prune, and went on granting `manage_access` over another tenant's organization. Emitting it
  // as the same edge shape routes it through the check that already validates `api_key` parents.
  if (
    resource.objectType === "organization" &&
    subject.objectType === "api_key" &&
    ORGANIZATION_API_KEY_RELATIONS.has(relation)
  ) {
    return { childId: subject.objectId, childType: "api_key", organizationId: resource.objectId };
  }

  if (relation !== PARENT_RELATION || subject.objectType !== "organization") {
    return null;
  }
  if (
    resource.objectType !== "api_key" &&
    resource.objectType !== "team" &&
    resource.objectType !== "workspace"
  ) {
    return null;
  }

  return { childId: resource.objectId, childType: resource.objectType, organizationId: subject.objectId };
};

/**
 * Source records PostgreSQL holds that SpiceDB has no relationship for.
 *
 * The other half of the drift picture. Without it a report can only find *stale* relationships, so an
 * entirely empty SpiceDB reads as clean against a fully populated PostgreSQL — which is precisely the
 * state the backfill exists to fix.
 *
 * Deliberately a set difference over source *records*, not over relationships. It answers "is this
 * record projected at all?" and **not** "is it projected with the right relation": a membership stored
 * as `owner` in PostgreSQL but `member` in SpiceDB appears on neither side of this diff, because both
 * map to the same record. Converging a relation is what applying does unconditionally by writing the
 * current value; detecting a wrong one would mean rebuilding every expected relationship here, which is
 * the projectors' job and not worth duplicating.
 */
export const findUnprojectedSourceRefs = (
  expected: ReadonlyArray<TAuthzedSourceRef>,
  observed: ReadonlyArray<TAuthzedSourceRef>
): ReadonlyArray<TAuthzedSourceRef> => {
  const observedKeys = new Set(observed.map(sourceRefKey));
  const unprojected = new Map<string, TAuthzedSourceRef>();

  for (const ref of expected) {
    const key = sourceRefKey(ref);
    if (!observedKeys.has(key)) {
      unprojected.set(key, ref);
    }
  }

  return [...unprojected.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref);
};

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
  const parentEdges = new Map<string, TAuthzedParentEdge>();
  let ignored = 0;

  for (const relationship of relationships) {
    if (isUnprojectedResourceType(relationship.resource.objectType)) {
      ignored++;
      continue;
    }

    const parentEdge = toParentEdge(relationship);
    if (parentEdge) {
      parentEdges.set(JSON.stringify(parentEdge), parentEdge);
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
    parentEdges: [...parentEdges.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, edge]) => edge),
    sourceRefs: [...sourceRefs.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, ref]) => ref),
    unmanaged: [...unmanaged.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, ref]) => ref),
  };
};
