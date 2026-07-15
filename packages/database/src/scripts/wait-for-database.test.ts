import { once } from "node:events";
import * as NodeNet from "node:net";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkDatabaseTcpConnection,
  getMigrationDatabaseUrl,
  parseCliOptions,
  parseDatabaseEndpoint,
  waitForDatabase,
} from "./wait-for-database";

const { createConnectionMock } = vi.hoisted(() => ({
  createConnectionMock: vi.fn(),
}));

vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeNet>();
  createConnectionMock.mockImplementation(actual.createConnection);

  return {
    ...actual,
    createConnection: createConnectionMock,
  };
});

const servers: ReturnType<typeof NodeNet.createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        })
    )
  );
});

describe("getMigrationDatabaseUrl", () => {
  test("prefers a non-empty MIGRATE_DATABASE_URL", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: "postgresql://app:secret@app-db/formbricks",
        MIGRATE_DATABASE_URL: " postgresql://migrate:secret@migrate-db/formbricks ",
      })
    ).toBe("postgresql://migrate:secret@migrate-db/formbricks");
  });

  test("falls back to DATABASE_URL", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: "postgresql://app:secret@app-db/formbricks",
        MIGRATE_DATABASE_URL: " ",
      })
    ).toBe("postgresql://app:secret@app-db/formbricks");
  });

  test("fails when neither URL is configured", () => {
    expect(() => getMigrationDatabaseUrl({})).toThrow("MIGRATE_DATABASE_URL or DATABASE_URL is required");
  });
});

describe("parseDatabaseEndpoint", () => {
  test.each([
    ["postgresql://user:secret@database/formbricks", { host: "database", port: 5432 }],
    ["postgres://user:secret@database:6432/formbricks", { host: "database", port: 6432 }],
    ["postgresql://user:secret@[2001:db8::1]:7432/formbricks", { host: "2001:db8::1", port: 7432 }],
  ])("parses %s", (databaseUrl, expectedEndpoint) => {
    expect(parseDatabaseEndpoint(databaseUrl)).toEqual(expectedEndpoint);
  });

  test("rejects non-PostgreSQL URLs without echoing the value", () => {
    const secretUrl = "mysql://admin:super-secret@database/formbricks";

    try {
      parseDatabaseEndpoint(secretUrl);
      expect.unreachable("Expected URL parsing to fail");
    } catch (error) {
      expect(String(error)).toContain("must use the postgres or postgresql protocol");
      expect(String(error)).not.toContain("admin");
      expect(String(error)).not.toContain("super-secret");
    }
  });
});

describe("parseCliOptions", () => {
  test("uses safe defaults", () => {
    expect(parseCliOptions([])).toEqual({
      connectionTimeoutSeconds: 5,
      intervalSeconds: 5,
      timeoutSeconds: 900,
    });
  });

  test("accepts positive overrides", () => {
    expect(
      parseCliOptions([
        "--timeout-seconds",
        "60",
        "--interval-seconds",
        "2",
        "--connection-timeout-seconds",
        "3",
      ])
    ).toEqual({ connectionTimeoutSeconds: 3, intervalSeconds: 2, timeoutSeconds: 60 });
  });
});

describe("waitForDatabase", () => {
  test("retries delayed availability without failing the caller", async () => {
    let currentTimeMs = 0;
    const checkConnection = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(Object.assign(new Error("refused"), { code: "ECONNREFUSED" }))
      .mockRejectedValueOnce(Object.assign(new Error("refused"), { code: "ECONNREFUSED" }))
      .mockResolvedValue(undefined);

    await waitForDatabase(
      {
        connectionTimeoutSeconds: 1,
        endpoint: { host: "database", port: 5432 },
        intervalSeconds: 2,
        timeoutSeconds: 10,
      },
      {
        checkConnection,
        log: vi.fn(),
        now: () => currentTimeMs,
        sleep: (durationMs) => {
          currentTimeMs += durationMs;
          return Promise.resolve();
        },
      }
    );

    expect(checkConnection).toHaveBeenCalledTimes(3);
  });

  test("times out with a safe error code", async () => {
    let currentTimeMs = 0;
    const logs: string[] = [];

    await expect(
      waitForDatabase(
        {
          connectionTimeoutSeconds: 1,
          endpoint: { host: "database", port: 5432 },
          intervalSeconds: 5,
          timeoutSeconds: 10,
        },
        {
          checkConnection: () =>
            Promise.reject(
              Object.assign(new Error("postgresql://admin:super-secret@database/formbricks"), {
                code: "ECONNREFUSED",
              })
            ),
          log: (message) => logs.push(message),
          now: () => currentTimeMs,
          sleep: (durationMs) => {
            currentTimeMs += durationMs;
            return Promise.resolve();
          },
        }
      )
    ).rejects.toThrow("last error code: ECONNREFUSED");

    expect(logs.join("\n")).not.toContain("admin");
    expect(logs.join("\n")).not.toContain("super-secret");
  });
});

describe("checkDatabaseTcpConnection", () => {
  test("closes the socket after a successful readiness check", async () => {
    const serverSockets = new Set<NodeNet.Socket>();
    const server = NodeNet.createServer((socket) => {
      serverSockets.add(socket);
      socket.once("close", () => {
        serverSockets.delete(socket);
      });
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as NodeNet.AddressInfo;

    await checkDatabaseTcpConnection({ host: "127.0.0.1", port: address.port }, 1_000);

    await vi.waitFor(() => {
      expect(serverSockets.size).toBe(0);
    });
  });

  test("handles errors emitted after timeout cleanup", async () => {
    const socket = new NodeNet.Socket();
    const lateError = Object.assign(new Error("connection cancelled"), { code: "ECANCELED" });
    const destroySpy = vi.spyOn(socket, "destroy").mockImplementation(() => {
      queueMicrotask(() => {
        socket.emit("error", lateError);
      });
      return socket;
    });
    createConnectionMock.mockReturnValueOnce(socket);

    const connection = checkDatabaseTcpConnection({ host: "database", port: 5432 }, 1_000);
    socket.emit("timeout");

    await expect(connection).rejects.toMatchObject({ code: "ETIMEDOUT" });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(destroySpy).toHaveBeenCalledOnce();
  });
});
