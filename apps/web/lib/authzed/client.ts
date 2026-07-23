import "server-only";
import { deadlineInterceptor, v1 } from "@authzed/authzed-node";
import { env } from "@/lib/env";
import { type TAuthzedConsistency, isAuthzedEnabled } from "./config";
import { AUTHZED_REQUEST_TIMEOUT_MS } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError, mapAuthzedError } from "./errors";
import { executeAuthzedOperation } from "./retry";

export type TAuthzedSchema = Readonly<{
  schemaText: string;
}>;

export type TAuthzedSchemaDiff = Readonly<{
  differenceCount: number;
  differenceKinds: Readonly<Record<string, number>>;
}>;

export type TAuthzedClient = Readonly<{
  consistency: TAuthzedConsistency;
  diffSchema: (schemaText: string) => Promise<TAuthzedSchemaDiff>;
  readSchema: () => Promise<TAuthzedSchema>;
  systemKey: string;
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
