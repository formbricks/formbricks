import "server-only";
import { deadlineInterceptor, v1 } from "@authzed/authzed-node";
import { env } from "@/lib/env";
import { type TAuthzedConsistency, isAuthzedEnabled } from "./config";
import {
  AUTHZED_BULK_REQUEST_TIMEOUT_MS,
  AUTHZED_MAX_RELATIONSHIP_READS,
  AUTHZED_MAX_RELATIONSHIP_UPDATES,
  AUTHZED_MAX_RESOURCE_LOOKUP_RESULTS,
  AUTHZED_REQUEST_TIMEOUT_MS,
  AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE,
} from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError, mapAuthzedError } from "./errors";
import { executeAuthzedOperation } from "./retry";

export type TAuthzedSchema = Readonly<{
  schemaText: string;
}>;

export type TAuthzedSchemaDiff = Readonly<{
  differenceCount: number;
  differenceKinds: Readonly<Record<string, number>>;
}>;

export type TAuthzedObjectReference = Readonly<{
  objectId: string;
  objectType: string;
}>;

export type TAuthzedPermissionCheck = Readonly<{
  permission: string;
  resource: TAuthzedObjectReference;
  subject: TAuthzedObjectReference;
}>;

export type TAuthzedPermissionDecision = Readonly<{
  allowed: boolean;
}>;

export type TAuthzedResourceLookup = Readonly<{
  permission: string;
  resourceType: string;
  subject: TAuthzedObjectReference;
}>;

export type TAuthzedResourceLookupResult = Readonly<{
  resourceIds: ReadonlyArray<string>;
}>;

export type TAuthzedSubjectReference = TAuthzedObjectReference &
  Readonly<{
    relation?: string;
  }>;

export type TAuthzedRelationship = Readonly<{
  relation: string;
  resource: TAuthzedObjectReference;
  subject: TAuthzedSubjectReference;
}>;

export type TAuthzedRelationshipUpdate = Readonly<{
  operation: "delete" | "touch";
  relationship: TAuthzedRelationship;
}>;

type TAuthzedSubjectFilter = Readonly<{
  objectId: string;
  objectType: string;
  relation?: string;
}>;

type TAuthzedRelationshipFilterBase = Readonly<{
  relation?: string;
  resourceType: string;
}>;

export type TAuthzedRelationshipFilter =
  | (TAuthzedRelationshipFilterBase &
      Readonly<{
        resourceId: string;
        subject?: TAuthzedSubjectFilter;
      }>)
  | (TAuthzedRelationshipFilterBase &
      Readonly<{
        resourceId?: never;
        subject: TAuthzedSubjectFilter;
      }>);

/** An opaque SpiceDB revision. Formbricks-owned wrapper: the SDK's ZedToken never crosses the facade. */
export type TAuthzedSnapshot = Readonly<{
  token: string;
}>;

/** An opaque resume position within a relationship read. */
export type TAuthzedReadCursor = Readonly<{
  token: string;
}>;

/**
 * Filter for reading relationships.
 *
 * Unlike `TAuthzedRelationshipFilter` this is a plain object rather than a union, so a
 * `resourceType`-only sweep is expressible. Because `resourceId` here is `string | undefined`, this type
 * satisfies neither branch of the delete filter's union, so passing a read filter to
 * `deleteRelationships` is a compile error.
 *
 * That narrows deletes, it does not bound them: the delete filter also admits a subject-only form with
 * no `resourceId`, which is how user-deletion cleanup removes one subject's relationships across every
 * organization or team. Such a delete is unlimited and transactional, bounded only by how many
 * relationships match — so a new call site has to reason about the match size itself.
 *
 * `optionalResourceIdPrefix` is deliberately not surfaced: Formbricks object IDs are unprefixed
 * cuids, so it could never narrow anything, and unused surface on a frozen facade is a liability.
 */
export type TAuthzedRelationshipReadFilter = Readonly<{
  relation?: string;
  resourceId?: string;
  resourceType: string;
  subject?: TAuthzedSubjectFilter;
}>;

export type TAuthzedRelationshipQuery = Readonly<{
  /**
   * Resume position from a previous page.
   *
   * The cursor carries the revision it was issued at, so continuing with one keeps the whole read on a
   * single consistent view, and SpiceDB rejects a cursor presented alongside *any* other changed
   * argument — including a changed consistency requirement.
   *
   * Both behaviours are verified against SpiceDB v1.52 (`pkg/middleware/consistency` prefers the
   * cursor's revision over the stated requirement; `internal/services/v1/hash.go` hashes the
   * consistency, filter and limit into the cursor) and against a real engine in the compose smoke test.
   * Neither is part of the published API contract, so a server upgrade should re-verify them — the
   * revision-stability check in `readAllRelationships` is the guard if they ever change.
   */
  cursor?: TAuthzedReadCursor;
  filter: TAuthzedRelationshipReadFilter;
  limit: number;
}>;

export type TAuthzedRelationshipPage = Readonly<{
  /** Resume position, or `null` when the page was short and the read is exhausted. */
  cursor: TAuthzedReadCursor | null;
  relationships: ReadonlyArray<TAuthzedRelationship>;
  /** Revision this page was read at. Constant across the pages of one cursored read. */
  snapshot: TAuthzedSnapshot | null;
}>;

export type TAuthzedClient = Readonly<{
  checkPermission: (check: TAuthzedPermissionCheck) => Promise<TAuthzedPermissionDecision>;
  consistency: TAuthzedConsistency;
  deleteRelationships: (filter: TAuthzedRelationshipFilter) => Promise<void>;
  diffSchema: (schemaText: string) => Promise<TAuthzedSchemaDiff>;
  /**
   * Read one page of raw relationships.
   *
   * **Operational use only — never for permission logic.** AuthZed's guidance is explicit that
   * checks and ID listing must go through `Check`, `CheckBulk`, `LookupResources`, and
   * `LookupSubjects`; reading raw relationships to decide access reimplements the permission graph
   * in application code and silently diverges from the schema. This exists so operational tooling
   * can observe what SpiceDB actually holds and reconcile it against PostgreSQL. It is deliberately
   * not re-exported from `./index`.
   */
  readRelationships: (query: TAuthzedRelationshipQuery) => Promise<TAuthzedRelationshipPage>;
  readSchema: () => Promise<TAuthzedSchema>;
  systemKey: string;
  writeRelationships: (updates: ReadonlyArray<TAuthzedRelationshipUpdate>) => Promise<void>;
  writeSchema: (schemaText: string) => Promise<void>;
}>;

/** Direct-path authorization infrastructure only; intentionally absent from the public barrel. */
export type TAuthzedResourceLookupClient = TAuthzedClient &
  Readonly<{
    lookupResources: (lookup: TAuthzedResourceLookup) => Promise<TAuthzedResourceLookupResult>;
  }>;

type TAuthzedClientSingleton = Readonly<{
  close: () => void;
  facade: TAuthzedResourceLookupClient;
}>;

type TAuthzedConfig =
  | Readonly<{
      enabled: false;
      insecure: boolean;
    }>
  | Readonly<{
      enabled: true;
      endpoint: string;
      insecure: boolean;
      systemKey: string;
      token: string;
    }>;

const globalForAuthzed = globalThis as unknown as {
  formbricksAuthzedClient: TAuthzedClientSingleton | undefined;
  formbricksAuthzedRequestTimeoutMs: number | undefined;
};

const STABLE_SCHEMA_DIFF_KINDS = {
  caveatAdded: "caveat_added",
  caveatDocCommentChanged: "caveat_doc_comment_changed",
  caveatExprChanged: "caveat_expr_changed",
  caveatParameterAdded: "caveat_parameter_added",
  caveatParameterRemoved: "caveat_parameter_removed",
  caveatParameterTypeChanged: "caveat_parameter_type_changed",
  caveatRemoved: "caveat_removed",
  definitionAdded: "definition_added",
  definitionDocCommentChanged: "definition_doc_comment_changed",
  definitionRemoved: "definition_removed",
  permissionAdded: "permission_added",
  permissionDocCommentChanged: "permission_doc_comment_changed",
  permissionExprChanged: "permission_expr_changed",
  permissionRemoved: "permission_removed",
  relationAdded: "relation_added",
  relationDocCommentChanged: "relation_doc_comment_changed",
  relationRemoved: "relation_removed",
  relationSubjectTypeAdded: "relation_subject_type_added",
  relationSubjectTypeRemoved: "relation_subject_type_removed",
} as const;

const toStableDiffKind = (kind: string | undefined): string => {
  if (!kind || !Object.hasOwn(STABLE_SCHEMA_DIFF_KINDS, kind)) {
    return "unknown";
  }

  return STABLE_SCHEMA_DIFF_KINDS[kind as keyof typeof STABLE_SCHEMA_DIFF_KINDS];
};

const getAuthzedConfig = (): TAuthzedConfig => {
  const insecure = env.AUTHZED_INSECURE === "true" || env.AUTHZED_INSECURE === "1";

  if (!isAuthzedEnabled()) {
    return { enabled: false, insecure };
  }

  const { AUTHZED_ENDPOINT: endpoint, AUTHZED_SYSTEM_KEY: systemKey, AUTHZED_TOKEN: token } = env;

  if (!endpoint || !systemKey || !token) {
    throw new Error("Enabled AuthZed configuration was not validated");
  }

  return {
    enabled: true,
    endpoint,
    insecure,
    systemKey,
    token,
  };
};

const isNonEmpty = (value: string): boolean => value.length > 0;

const validatePermissionCheck = (check: TAuthzedPermissionCheck): void => {
  if (
    !isNonEmpty(check.permission) ||
    !isNonEmpty(check.resource.objectId) ||
    !isNonEmpty(check.resource.objectType) ||
    !isNonEmpty(check.subject.objectId) ||
    !isNonEmpty(check.subject.objectType)
  ) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
      operation: "check_permission",
      retryable: false,
    });
  }
};

const validateResourceLookup = (lookup: TAuthzedResourceLookup): void => {
  if (
    !isNonEmpty(lookup.permission) ||
    !isNonEmpty(lookup.resourceType) ||
    !isNonEmpty(lookup.subject.objectId) ||
    !isNonEmpty(lookup.subject.objectType)
  ) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
      operation: "lookup_resources",
      retryable: false,
    });
  }
};

const getAuthorizationConsistency = () => ({
  requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" as const },
});

const validateRelationshipUpdates = (updates: ReadonlyArray<TAuthzedRelationshipUpdate>): void => {
  if (updates.length === 0 || updates.length > AUTHZED_MAX_RELATIONSHIP_UPDATES) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
      operation: "write_relationships",
      retryable: false,
    });
  }

  const valid = updates.every(
    ({ relationship }) =>
      isNonEmpty(relationship.resource.objectType) &&
      isNonEmpty(relationship.resource.objectId) &&
      isNonEmpty(relationship.relation) &&
      isNonEmpty(relationship.subject.objectType) &&
      isNonEmpty(relationship.subject.objectId) &&
      (relationship.subject.relation === undefined || isNonEmpty(relationship.subject.relation))
  );

  if (!valid) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
      operation: "write_relationships",
      retryable: false,
    });
  }
};

const validateRelationshipFilter = (filter: TAuthzedRelationshipFilter): void => {
  const hasResourceId = filter.resourceId !== undefined && isNonEmpty(filter.resourceId);
  const hasSubjectId = filter.subject !== undefined && isNonEmpty(filter.subject.objectId);
  const valid =
    isNonEmpty(filter.resourceType) &&
    (filter.relation === undefined || isNonEmpty(filter.relation)) &&
    (filter.subject === undefined ||
      (isNonEmpty(filter.subject.objectType) &&
        (filter.subject.relation === undefined || isNonEmpty(filter.subject.relation))));

  if (!valid || (!hasResourceId && !hasSubjectId)) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
      operation: "delete_relationships",
      retryable: false,
    });
  }
};

const invalidReadRequest = (): AuthzedError =>
  new AuthzedError({
    attempts: 0,
    code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
    operation: "read_relationships",
    retryable: false,
  });

const validateRelationshipQuery = (query: TAuthzedRelationshipQuery): void => {
  const { filter } = query;
  const optionalFieldsValid =
    (filter.relation === undefined || isNonEmpty(filter.relation)) &&
    (filter.resourceId === undefined || isNonEmpty(filter.resourceId)) &&
    (filter.subject === undefined ||
      (isNonEmpty(filter.subject.objectType) &&
        isNonEmpty(filter.subject.objectId) &&
        (filter.subject.relation === undefined || isNonEmpty(filter.subject.relation))));

  // A limit is mandatory and must be positive: SpiceDB treats `optionalLimit: 0` as *unlimited*,
  // which under the channel-wide deadline is a guaranteed timeout and an unbounded allocation,
  // because the promisified streaming call buffers every message before it resolves.
  const limitValid =
    Number.isSafeInteger(query.limit) && query.limit >= 1 && query.limit <= AUTHZED_MAX_RELATIONSHIP_READS;

  const tokensValid = query.cursor === undefined || isNonEmpty(query.cursor.token);

  if (!isNonEmpty(filter.resourceType) || !optionalFieldsValid || !limitValid || !tokensValid) {
    throw invalidReadRequest();
  }
};

/**
 * Convert one streamed response into a facade relationship.
 *
 * Strict by design. Every field below is optional in the generated SDK types, and a missing one
 * would yield a relationship that compares unequal to the tuple Formbricks wrote — which reconciling
 * tooling would classify as orphaned and delete. Failing loudly is the only safe reading.
 */
const toFacadeRelationship = (response: v1.ReadRelationshipsResponse): TAuthzedRelationship => {
  const relationship = response.relationship;
  const resource = relationship?.resource;
  const subject = relationship?.subject?.object;

  // The message fields are optional in the generated types; the scalars inside them are plain protobuf
  // strings that default to `""` when absent from the wire. Both have to be rejected, or a relationship
  // with an empty relation or object ID passes here, matches no tuple Formbricks ever wrote, and gets
  // classified as orphaned — which under `--prune` means deleted. Same fail-loud rule, same reason.
  if (
    !relationship ||
    !resource ||
    !subject ||
    !relationship.relation ||
    !resource.objectId ||
    !resource.objectType ||
    !subject.objectId ||
    !subject.objectType
  ) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "read_relationships",
      retryable: false,
    });
  }

  // Formbricks never writes caveated or expiring relationships and the facade cannot represent them, so
  // dropping the qualifier would misreport the tuple — and a misreported tuple is exactly what
  // reconciling tooling would classify as stale. Refusing is therefore the safe reading today.
  //
  // Note this becomes a tripwire the day Formbricks adopts SpiceDB's expiration feature, which AuthZed
  // recommends for time-limited access: the facade must learn to represent it before anything writes
  // one, or reconciliation will start refusing to run.
  if (relationship.optionalCaveat !== undefined || relationship.optionalExpiresAt !== undefined) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.UNSUPPORTED,
      operation: "read_relationships",
      retryable: false,
    });
  }

  const subjectRelation = relationship.subject?.optionalRelation;

  return {
    relation: relationship.relation,
    resource: { objectId: resource.objectId, objectType: resource.objectType },
    subject: {
      objectId: subject.objectId,
      objectType: subject.objectType,
      // Normalize the wire's empty string back to `undefined` so a subject-relation tuple such as
      // `workspace:x#reader_team@team:y#member` round-trips equal to the update that wrote it.
      ...(subjectRelation ? { relation: subjectRelation } : {}),
    },
  };
};

const createAuthzedClient = (requestTimeoutMs: number): TAuthzedClientSingleton => {
  const config = getAuthzedConfig();

  if (!config.enabled) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.DISABLED,
      operation: "client_initialization",
      retryable: false,
    });
  }

  const security = config.insecure
    ? v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS
    : v1.ClientSecurity.SECURE;
  // The SDK appends its own 30s deadline interceptor last, and that interceptor only sets a deadline
  // when none is present — so whatever is installed here wins for every call on this channel.
  const sdkClient = v1.NewClient(config.token, config.endpoint, security, undefined, {
    interceptors: [deadlineInterceptor(requestTimeoutMs)],
  });

  const facade = Object.freeze<TAuthzedResourceLookupClient>({
    checkPermission: async (check) => {
      validatePermissionCheck(check);

      return executeAuthzedOperation("check_permission", async () => {
        const response = await sdkClient.promises.checkPermission({
          consistency: getAuthorizationConsistency(),
          context: undefined,
          permission: check.permission,
          resource: {
            objectId: check.resource.objectId,
            objectType: check.resource.objectType,
          },
          subject: {
            object: {
              objectId: check.subject.objectId,
              objectType: check.subject.objectType,
            },
            optionalRelation: "",
          },
          withTracing: false,
        });

        if (response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION) {
          return { allowed: true };
        }

        if (response.permissionship === v1.CheckPermissionResponse_Permissionship.NO_PERMISSION) {
          return { allowed: false };
        }

        throw new AuthzedError({
          attempts: 1,
          code: AUTHZED_ERROR_CODES.UNSUPPORTED,
          operation: "check_permission",
          retryable: false,
        });
      });
    },
    consistency: "fully_consistent",
    deleteRelationships: async (filter) => {
      validateRelationshipFilter(filter);

      await executeAuthzedOperation("delete_relationships", async () => {
        const response = await sdkClient.promises.deleteRelationships({
          optionalAllowPartialDeletions: false,
          optionalLimit: 0,
          optionalPreconditions: [],
          relationshipFilter: {
            optionalRelation: filter.relation ?? "",
            optionalResourceId: filter.resourceId ?? "",
            optionalResourceIdPrefix: "",
            optionalSubjectFilter: filter.subject
              ? {
                  optionalRelation: filter.subject.relation
                    ? { relation: filter.subject.relation }
                    : undefined,
                  optionalSubjectId: filter.subject.objectId,
                  subjectType: filter.subject.objectType,
                }
              : undefined,
            resourceType: filter.resourceType,
          },
        });

        // Asserted rather than assumed. An unlimited, non-partial delete should always report
        // `COMPLETE`, but this is the one call in the facade that destroys access, and "SpiceDB said it
        // only got part way and we carried on believing it finished" is the failure that leaves a
        // half-revoked graph while the caller reports success. A server-side cap or a change in SDK
        // defaults would surface here instead of silently.
        if (response.deletionProgress !== v1.DeleteRelationshipsResponse_DeletionProgress.COMPLETE) {
          throw new AuthzedError({
            attempts: 1,
            code: AUTHZED_ERROR_CODES.INTERNAL,
            operation: "delete_relationships",
            retryable: true,
          });
        }
      });
    },
    diffSchema: async (schemaText) =>
      executeAuthzedOperation("diff_schema", async () => {
        const response = await sdkClient.promises.diffSchema({
          comparisonSchema: schemaText,
          // Operational schema checks must observe the latest write. The application's configurable
          // permission-check consistency is intentionally not used for deployment verification.
          consistency: {
            requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" },
          },
        });
        const differenceKinds = response.diffs.reduce<Record<string, number>>((counts, difference) => {
          const kind = toStableDiffKind(difference.diff.oneofKind);
          counts[kind] = (counts[kind] ?? 0) + 1;
          return counts;
        }, {});

        return {
          differenceCount: response.diffs.length,
          differenceKinds: Object.freeze(differenceKinds),
        };
      }),
    lookupResources: async (lookup) => {
      validateResourceLookup(lookup);

      const consistency = getAuthorizationConsistency();
      const resourceIds = new Set<string>();
      let cursor: string | undefined;
      let resultCount = 0;

      do {
        const responses = await executeAuthzedOperation("lookup_resources", () =>
          sdkClient.promises.lookupResources({
            consistency,
            context: undefined,
            optionalCursor: cursor ? { token: cursor } : undefined,
            optionalLimit: AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE,
            permission: lookup.permission,
            resourceObjectType: lookup.resourceType,
            subject: {
              object: {
                objectId: lookup.subject.objectId,
                objectType: lookup.subject.objectType,
              },
              optionalRelation: "",
            },
          })
        );

        if (
          responses.some(
            (response) =>
              response.permissionship !== v1.LookupPermissionship.HAS_PERMISSION ||
              !isNonEmpty(response.resourceObjectId)
          )
        ) {
          throw new AuthzedError({
            attempts: 1,
            code: AUTHZED_ERROR_CODES.UNSUPPORTED,
            operation: "lookup_resources",
            retryable: false,
          });
        }

        resultCount += responses.length;
        if (resultCount > AUTHZED_MAX_RESOURCE_LOOKUP_RESULTS) {
          throw new AuthzedError({
            attempts: 0,
            code: AUTHZED_ERROR_CODES.LIMIT_EXCEEDED,
            operation: "lookup_resources",
            retryable: false,
          });
        }

        for (const { resourceObjectId } of responses) {
          resourceIds.add(resourceObjectId);
        }

        if (responses.length < AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE) {
          cursor = undefined;
          continue;
        }

        const nextCursor = responses.at(-1)?.afterResultCursor?.token;
        if (!nextCursor || nextCursor === cursor) {
          throw new AuthzedError({
            attempts: 0,
            code: AUTHZED_ERROR_CODES.INTERNAL,
            operation: "lookup_resources",
            retryable: false,
          });
        }
        cursor = nextCursor;
      } while (cursor);

      return {
        resourceIds: Object.freeze([...resourceIds].sort((left, right) => left.localeCompare(right))),
      };
    },
    readRelationships: async (query) => {
      validateRelationshipQuery(query);

      return executeAuthzedOperation("read_relationships", async () => {
        const { filter } = query;
        const responses = await sdkClient.promises.readRelationships({
          // Fully consistent so reconciliation observes the latest write, matching `diffSchema`: the
          // application's configurable permission-check consistency is never used for operational
          // verification.
          //
          // The same requirement is sent on every page rather than pinning the first page's revision on
          // later ones. It has to be: SpiceDB hashes the consistency into the cursor and rejects a
          // mismatch. It also does not need the help — the cursor's own revision takes precedence over
          // whatever requirement is stated — so substituting `atExactSnapshot` on later pages would both
          // invalidate the cursor and add snapshot-expiry exposure for nothing.
          consistency: { requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" } },
          optionalCursor: query.cursor ? { token: query.cursor.token } : undefined,
          optionalLimit: query.limit,
          relationshipFilter: {
            optionalRelation: filter.relation ?? "",
            optionalResourceId: filter.resourceId ?? "",
            optionalResourceIdPrefix: "",
            optionalSubjectFilter: filter.subject
              ? {
                  optionalRelation: filter.subject.relation
                    ? { relation: filter.subject.relation }
                    : undefined,
                  optionalSubjectId: filter.subject.objectId,
                  subjectType: filter.subject.objectType,
                }
              : undefined,
            resourceType: filter.resourceType,
          },
        });

        const lastResponse = responses.at(-1);
        const readAt = lastResponse?.readAt?.token;

        // A non-empty page always carries the revision it was read at. Without it a caller cannot tell
        // whether successive pages describe the same view, so refuse rather than silently degrade.
        if (lastResponse && !readAt) {
          throw new AuthzedError({
            attempts: 0,
            code: AUTHZED_ERROR_CODES.INTERNAL,
            operation: "read_relationships",
            retryable: false,
          });
        }

        const afterResultCursor = lastResponse?.afterResultCursor?.token;

        return {
          // A short page means the filter is exhausted. Only a full page can have more behind it, and
          // only then is a cursor meaningful.
          cursor: responses.length === query.limit && afterResultCursor ? { token: afterResultCursor } : null,
          relationships: responses.map(toFacadeRelationship),
          snapshot: readAt ? { token: readAt } : null,
        };
      });
    },
    readSchema: async () => {
      const schemaText = await executeAuthzedOperation("read_schema", async () => {
        try {
          const response = await sdkClient.promises.readSchema({});
          return response.schemaText;
        } catch (error) {
          // SpiceDB reports NOT_FOUND until the first schema is installed. For ReadSchema specifically,
          // that is the empty-schema state rather than a failed connection.
          if (mapAuthzedError(error, "read_schema", 1).code === AUTHZED_ERROR_CODES.NOT_FOUND) {
            return "";
          }

          throw error;
        }
      });
      return { schemaText };
    },
    systemKey: config.systemKey,
    // TOUCH and DELETE relationship updates are idempotent. Keep retries opt-in at this facade
    // operation so future non-idempotent mutations cannot inherit them accidentally.
    writeRelationships: async (updates) => {
      validateRelationshipUpdates(updates);

      await executeAuthzedOperation("write_relationships", async () => {
        await sdkClient.promises.writeRelationships({
          optionalPreconditions: [],
          updates: updates.map(({ operation, relationship }) => ({
            operation:
              operation === "touch"
                ? v1.RelationshipUpdate_Operation.TOUCH
                : v1.RelationshipUpdate_Operation.DELETE,
            relationship: {
              optionalCaveat: undefined,
              optionalExpiresAt: undefined,
              relation: relationship.relation,
              resource: {
                objectId: relationship.resource.objectId,
                objectType: relationship.resource.objectType,
              },
              subject: {
                object: {
                  objectId: relationship.subject.objectId,
                  objectType: relationship.subject.objectType,
                },
                optionalRelation: relationship.subject.relation ?? "",
              },
            },
          })),
        });
      });
    },
    // Repeating WriteSchema with the exact same schema is idempotent. Keep this explicit so future
    // relationship writes cannot inherit retries accidentally.
    writeSchema: async (schemaText) => {
      await executeAuthzedOperation("write_schema", async () => {
        await sdkClient.promises.writeSchema({ schema: schemaText });
      });
    },
  });

  return {
    close: () => sdkClient.close(),
    facade,
  };
};

/**
 * Widen this process's channel deadline to the bulk one, before any client exists.
 *
 * The deadline belongs to the channel, not to a call — the SDK's promisified streaming wrappers accept
 * no per-call options at all — and every projector reaches the channel through `getAuthzedClient()`
 * rather than being handed one. So "a separate client for bulk work" is not expressible: a command that
 * both sweeps and writes would need one channel at two deadlines.
 *
 * It is a property of the *process* instead. A request-serving process wants the short deadline on
 * everything, because a projection that hangs holds a user's request open; a command-line process wants
 * the long one on everything, because a page of relationships legitimately takes longer than a single
 * `Check`. Command entry points call this first, and it refuses to run once a client exists — silently
 * leaving the short deadline in place would strand the sweep on its first slow page, which is precisely
 * the failure this replaced.
 */
export const configureAuthzedClientForBulkWork = (): void => {
  if (globalForAuthzed.formbricksAuthzedClient) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
      operation: "configure_authzed_client_for_bulk_work",
      retryable: false,
    });
  }

  globalForAuthzed.formbricksAuthzedRequestTimeoutMs = AUTHZED_BULK_REQUEST_TIMEOUT_MS;
};

/** The shared client. Deadline sized for a single cheap call unless the process asked for bulk work. */
export const getAuthzedClient = (): TAuthzedResourceLookupClient => {
  globalForAuthzed.formbricksAuthzedClient ??= createAuthzedClient(
    globalForAuthzed.formbricksAuthzedRequestTimeoutMs ?? AUTHZED_REQUEST_TIMEOUT_MS
  );

  return globalForAuthzed.formbricksAuthzedClient.facade;
};

export const closeAuthzedClient = (): void => {
  globalForAuthzed.formbricksAuthzedClient?.close();
  globalForAuthzed.formbricksAuthzedClient = undefined;
  globalForAuthzed.formbricksAuthzedRequestTimeoutMs = undefined;
};
