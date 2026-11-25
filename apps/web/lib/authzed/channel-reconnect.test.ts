import { loggerMocks } from "./__mocks__/logger";
import {
  type ChannelOptions,
  Server,
  ServerCredentials,
  type ServiceDefinition,
  credentials,
  makeGenericClientConstructor,
  status,
} from "@grpc/grpc-js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  AUTHZED_CHANNEL_OPTIONS,
  AUTHZED_RETRY_BASE_DELAYS_MS,
  AUTHZED_RETRY_JITTER_RATIO,
} from "./constants";
import { executeAuthzedOperation } from "./retry";

// A real grpc-js channel against a real server, so the reconnect backoff under test is grpc-js's own and
// not a model of it. The service is a one-method echo: what matters is the channel, not SpiceDB's API.
const echoService: ServiceDefinition = {
  echo: {
    path: "/formbricks.test.Echo/Echo",
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: Buffer) => value,
    requestDeserialize: (value: Buffer) => value,
    responseSerialize: (value: Buffer) => value,
    responseDeserialize: (value: Buffer) => value,
  },
};

const EchoClient = makeGenericClientConstructor(echoService, "Echo");
type TEchoClient = InstanceType<typeof EchoClient> & {
  echo: (
    request: Buffer,
    options: { deadline: number },
    callback: (error: { code?: number } | null, response?: Buffer) => void
  ) => void;
};

const startServer = async (port: number): Promise<{ server: Server; port: number }> => {
  const server = new Server();
  server.addService(echoService, {
    echo: (call: { request: Buffer }, callback: (error: null, response: Buffer) => void) =>
      callback(null, call.request),
  });
  const boundPort = await new Promise<number>((resolve, reject) => {
    server.bindAsync(`127.0.0.1:${port}`, ServerCredentials.createInsecure(), (error, bound) =>
      error ? reject(error) : resolve(bound)
    );
  });
  return { server, port: boundPort };
};

const echo = (client: TEchoClient): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    client.echo(Buffer.from("ping"), { deadline: Date.now() + 1_000 }, (error, response) =>
      error || !response ? reject(error ?? new Error("empty response")) : resolve(response)
    );
  });

/**
 * Leaves the channel the way a dropped SpiceDB connection leaves it in production: the server goes away,
 * one request finds the dead connection and fails, and the channel sits in TRANSIENT_FAILURE for its
 * reconnect backoff. SpiceDB is back up straight away — the blip is over before our retries start — so any
 * failure after this point is the channel's backoff alone.
 */
const dropConnectionThenRecover = async (
  options: ChannelOptions | undefined
): Promise<{ client: TEchoClient; server: Server }> => {
  const first = await startServer(0);
  const client = new EchoClient(
    `127.0.0.1:${first.port}`,
    credentials.createInsecure(),
    options
  ) as TEchoClient;
  await echo(client);

  first.server.forceShutdown();
  await expect(echo(client)).rejects.toMatchObject({ code: status.UNAVAILABLE });

  const second = await startServer(first.port);
  return { client, server: second.server };
};

describe("AuthZed channel recovery after a dropped connection", () => {
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    loggerMocks.debug.mockReset();
    loggerMocks.warn.mockReset();
  });

  afterEach(() => {
    cleanup.forEach((fn) => fn());
    cleanup = [];
  });

  test("the request-path retry outlives the channel's reconnect backoff once SpiceDB is back", async () => {
    const { client, server } = await dropConnectionThenRecover(AUTHZED_CHANNEL_OPTIONS);
    cleanup.push(
      () => client.close(),
      () => server.forceShutdown()
    );

    // The production retry policy, real sleeps and all. With grpc-js's default 1 s initial backoff all three
    // attempts land inside it and fail with UNAVAILABLE; the authorization check then 500s (ENG-7003).
    await expect(executeAuthzedOperation("check_permission", () => echo(client))).resolves.toEqual(
      Buffer.from("ping")
    );
  });

  test("the slowest first reconnect fits before the last retry's earliest start", () => {
    // The invariant the test above exercises, stated without a clock: even with grpc-js's ±20% jitter on the
    // first backoff, the channel is reconnecting before the final attempt, however the retry jitter falls.
    const firstBackoffMaxMs = AUTHZED_CHANNEL_OPTIONS["grpc.initial_reconnect_backoff_ms"] * 1.2;
    const lastAttemptEarliestMs = AUTHZED_RETRY_BASE_DELAYS_MS.reduce(
      (total, delay) => total + delay * (1 - AUTHZED_RETRY_JITTER_RATIO),
      0
    );

    expect(firstBackoffMaxMs).toBeLessThan(lastAttemptEarliestMs);
  });
});
