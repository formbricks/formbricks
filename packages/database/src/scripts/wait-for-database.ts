import { createConnection } from "node:net";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_INTERVAL_SECONDS = 5;
const DEFAULT_CONNECTION_TIMEOUT_SECONDS = 5;

export interface TDatabaseEndpoint {
  host: string;
  port: number;
}

interface TWaitForDatabaseOptions {
  connectionTimeoutSeconds: number;
  endpoint: TDatabaseEndpoint;
  intervalSeconds: number;
  timeoutSeconds: number;
}

interface TWaitForDatabaseDependencies {
  checkConnection?: (endpoint: TDatabaseEndpoint, timeoutMs: number) => Promise<void>;
  log?: (message: string) => void;
  now?: () => number;
  sleep?: (durationMs: number) => Promise<void>;
}

interface TWaitForDatabaseCliOptions {
  connectionTimeoutSeconds: number;
  intervalSeconds: number;
  timeoutSeconds: number;
}

const sleep = async (durationMs: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

const toPositiveNumber = (value: string, optionName: string): number => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${optionName} must be a positive number.`);
  }

  return parsedValue;
};

const getSafeErrorCode = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    return code.length > 0 ? code : "UNKNOWN";
  }

  return error instanceof Error && error.name.length > 0 ? error.name : "UNKNOWN";
};

export const getMigrationDatabaseUrl = (
  environment: { DATABASE_URL?: string; MIGRATE_DATABASE_URL?: string } = process.env
): string => {
  const migrateDatabaseUrl = environment.MIGRATE_DATABASE_URL?.trim();
  if (migrateDatabaseUrl) {
    return migrateDatabaseUrl;
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  if (databaseUrl) {
    return databaseUrl;
  }

  throw new Error("MIGRATE_DATABASE_URL or DATABASE_URL is required to wait for PostgreSQL.");
};

export const parseDatabaseEndpoint = (databaseUrl: string): TDatabaseEndpoint => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("The migration database URL must be a valid PostgreSQL URL.");
  }

  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("The migration database URL must use the postgres or postgresql protocol.");
  }

  if (!parsedUrl.hostname) {
    throw new Error("The migration database URL must include a hostname.");
  }

  const port = parsedUrl.port ? Number(parsedUrl.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("The migration database URL must include a valid TCP port.");
  }

  const host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;

  return { host, port };
};

export const checkDatabaseTcpConnection = async (
  endpoint: TDatabaseEndpoint,
  timeoutMs: number
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: endpoint.host, port: endpoint.port });
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish();
    });
    socket.once("error", (error) => {
      finish(error);
    });
    socket.once("timeout", () => {
      const timeoutError = Object.assign(new Error("PostgreSQL TCP connection timed out."), {
        code: "ETIMEDOUT",
      });
      finish(timeoutError);
    });
  });
};

export const waitForDatabase = async (
  options: TWaitForDatabaseOptions,
  dependencies: TWaitForDatabaseDependencies = {}
): Promise<void> => {
  const checkConnection = dependencies.checkConnection ?? checkDatabaseTcpConnection;
  const log = dependencies.log ?? console.log;
  const now = dependencies.now ?? Date.now;
  const wait = dependencies.sleep ?? sleep;
  const timeoutMs = options.timeoutSeconds * 1000;
  const intervalMs = options.intervalSeconds * 1000;
  const connectionTimeoutMs = options.connectionTimeoutSeconds * 1000;
  const startedAt = now();
  let attempt = 0;
  let lastErrorCode = "UNKNOWN";

  while (now() - startedAt < timeoutMs) {
    const remainingMs = timeoutMs - (now() - startedAt);

    if (remainingMs <= 0) {
      throw new Error(
        `PostgreSQL did not become reachable within ${options.timeoutSeconds.toString()} seconds (last error code: ${lastErrorCode}).`
      );
    }

    attempt += 1;

    try {
      await checkConnection(options.endpoint, Math.min(connectionTimeoutMs, remainingMs));
      log(`PostgreSQL is reachable after ${attempt.toString()} attempt(s).`);
      return;
    } catch (error) {
      lastErrorCode = getSafeErrorCode(error);
      const remainingAfterAttemptMs = timeoutMs - (now() - startedAt);

      if (remainingAfterAttemptMs <= 0) {
        throw new Error(
          `PostgreSQL did not become reachable within ${options.timeoutSeconds.toString()} seconds (last error code: ${lastErrorCode}).`
        );
      }

      const delayMs = Math.min(intervalMs, remainingAfterAttemptMs);
      log(
        `PostgreSQL is not reachable yet (attempt ${attempt.toString()}, error code: ${lastErrorCode}); retrying in ${(delayMs / 1000).toString()} second(s).`
      );
      await wait(delayMs);
    }
  }

  throw new Error(
    `PostgreSQL did not become reachable within ${options.timeoutSeconds.toString()} seconds (last error code: ${lastErrorCode}).`
  );
};

export const parseCliOptions = (args: string[]): TWaitForDatabaseCliOptions => {
  const options: TWaitForDatabaseCliOptions = {
    connectionTimeoutSeconds: DEFAULT_CONNECTION_TIMEOUT_SECONDS,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const optionName = args[index];
    const optionValue = args[index + 1];

    if (!optionValue) {
      throw new Error(`${optionName} requires a value.`);
    }

    switch (optionName) {
      case "--connection-timeout-seconds":
        options.connectionTimeoutSeconds = toPositiveNumber(optionValue, optionName);
        break;
      case "--interval-seconds":
        options.intervalSeconds = toPositiveNumber(optionValue, optionName);
        break;
      case "--timeout-seconds":
        options.timeoutSeconds = toPositiveNumber(optionValue, optionName);
        break;
      default:
        throw new Error(`Unknown option: ${optionName}`);
    }

    index += 1;
  }

  return options;
};

const main = async (): Promise<void> => {
  const databaseUrl = getMigrationDatabaseUrl();
  const endpoint = parseDatabaseEndpoint(databaseUrl);
  const options = parseCliOptions(process.argv.slice(2));

  await waitForDatabase({ endpoint, ...options });
};

const isDirectExecution = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "PostgreSQL readiness check failed.";
    console.error(message);
    process.exit(1);
  });
}
