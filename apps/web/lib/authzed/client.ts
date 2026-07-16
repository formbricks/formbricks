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

export type TAuthzedClient = Readonly<{
  consistency: TAuthzedConsistency;
  readSchema: () => Promise<TAuthzedSchema>;
  systemKey: string;
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
  });

  return {
    close: () => sdkClient.close(),
    facade,
  };
};

export const getAuthzedClient = (): TAuthzedClient => {
  if (!globalForAuthzed.formbricksAuthzedClient) {
    globalForAuthzed.formbricksAuthzedClient = createAuthzedClient();
  }

  return globalForAuthzed.formbricksAuthzedClient.facade;
};

export const closeAuthzedClient = (): void => {
  globalForAuthzed.formbricksAuthzedClient?.close();
  globalForAuthzed.formbricksAuthzedClient = undefined;
};
