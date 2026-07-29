import "server-only";
import { deadlineInterceptor, v1 } from "@authzed/authzed-node";
import { env } from "@/lib/env";
import { type TAuthzedConsistency, isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_RELATIONSHIP_UPDATES, AUTHZED_REQUEST_TIMEOUT_MS } from "./constants";
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

export type TAuthzedClient = Readonly<{
  consistency: TAuthzedConsistency;
  deleteRelationships: (filter: TAuthzedRelationshipFilter) => Promise<void>;
  diffSchema: (schemaText: string) => Promise<TAuthzedSchemaDiff>;
  readSchema: () => Promise<TAuthzedSchema>;
  systemKey: string;
  writeRelationships: (updates: ReadonlyArray<TAuthzedRelationshipUpdate>) => Promise<void>;
  writeSchema: (schemaText: string) => Promise<void>;
}>;

type TAuthzedClientSingleton = Readonly<{
  close: () => void;
  facade: TAuthzedClient;
}>;

type TAuthzedConfig =
  | Readonly<{
      consistency: TAuthzedConsistency;
      enabled: false;
      insecure: boolean;
    }>
  | Readonly<{
      consistency: TAuthzedConsistency;
      enabled: true;
      endpoint: string;
      insecure: boolean;
      systemKey: string;
      token: string;
    }>;

const globalForAuthzed = globalThis as unknown as {
  formbricksAuthzedClient: TAuthzedClientSingleton | undefined;
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
  const consistency = env.AUTHZED_CONSISTENCY ?? "minimize_latency";
  const insecure = env.AUTHZED_INSECURE === "true" || env.AUTHZED_INSECURE === "1";

  if (!isAuthzedEnabled()) {
    return { consistency, enabled: false, insecure };
  }

  const { AUTHZED_ENDPOINT: endpoint, AUTHZED_SYSTEM_KEY: systemKey, AUTHZED_TOKEN: token } = env;

  if (!endpoint || !systemKey || !token) {
    throw new Error("Enabled AuthZed configuration was not validated");
  }

  return {
    consistency,
    enabled: true,
    endpoint,
    insecure,
    systemKey,
    token,
  };
};

const isNonEmpty = (value: string): boolean => value.length > 0;

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

const createAuthzedClient = (): TAuthzedClientSingleton => {
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
  const sdkClient = v1.NewClient(config.token, config.endpoint, security, undefined, {
    interceptors: [deadlineInterceptor(AUTHZED_REQUEST_TIMEOUT_MS)],
  });

  const facade = Object.freeze<TAuthzedClient>({
    consistency: config.consistency,
    deleteRelationships: async (filter) => {
      validateRelationshipFilter(filter);

      await executeAuthzedOperation("delete_relationships", async () => {
        await sdkClient.promises.deleteRelationships({
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

export const getAuthzedClient = (): TAuthzedClient => {
  globalForAuthzed.formbricksAuthzedClient ??= createAuthzedClient();

  return globalForAuthzed.formbricksAuthzedClient.facade;
};

export const closeAuthzedClient = (): void => {
  globalForAuthzed.formbricksAuthzedClient?.close();
  globalForAuthzed.formbricksAuthzedClient = undefined;
};
