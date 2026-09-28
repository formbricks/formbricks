import { EventEmitter } from "node:events";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { afterEach, describe, expect, test, vi } from "vitest";

class DelayedClient extends EventEmitter {
  static instances: DelayedClient[] = [];

  connection = undefined;
  ended = false;
  endCalls = 0;

  constructor() {
    super();
    DelayedClient.instances.push(this);
  }

  connect(callback: (error?: Error) => void): void {
    setTimeout(callback, DelayedClient.instances.length === 1 ? 200 : 0);
  }

  end(callback?: () => void): void {
    this.ended = true;
    this.endCalls += 1;
    setTimeout(() => callback?.(), 50);
  }

  isConnected(): boolean {
    return false;
  }
}

class StuckConnectionClient extends EventEmitter {
  static instances: StuckConnectionClient[] = [];

  connection = {
    end: vi.fn(),
    stream: { destroy: vi.fn() },
  };

  constructor() {
    super();
    StuckConnectionClient.instances.push(this);
  }

  connect(callback: (error?: Error) => void): void {
    setTimeout(callback, 300);
  }

  isConnected(): boolean {
    return false;
  }
}

afterEach(() => {
  DelayedClient.instances = [];
  StuckConnectionClient.instances = [];
  vi.useRealTimers();
});

describe("pg-pool connection timeout patch", () => {
  test("rejects on time and closes a connection that establishes after the timeout", async () => {
    vi.useFakeTimers();
    const pool = new Pool({
      Client: DelayedClient as unknown as NonNullable<PoolConfig["Client"]>,
      connectionTimeoutMillis: 100,
      max: 1,
    });

    const connection = pool.connect();
    const rejection = expect(connection).rejects.toThrow("Connection terminated due to connection timeout");

    await vi.advanceTimersByTimeAsync(100);
    await rejection;

    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);

    await vi.advanceTimersByTimeAsync(100);

    expect(DelayedClient.instances).toHaveLength(1);
    expect(DelayedClient.instances[0].ended).toBe(true);
    expect(DelayedClient.instances[0].endCalls).toBe(1);
    await pool.end();
  });

  test("waits for a timed-out connection to close when shutdown starts in the checkout callback", async () => {
    vi.useFakeTimers();
    const pool = new Pool({
      Client: DelayedClient as unknown as NonNullable<PoolConfig["Client"]>,
      connectionTimeoutMillis: 100,
      max: 1,
    });
    let shutdownComplete = false;

    const shutdown = new Promise<void>((resolve, reject) => {
      pool.connect((error, client) => {
        try {
          expect(error).toMatchObject({ message: "Connection terminated due to connection timeout" });
          expect(client).toBeUndefined();
          void pool.end(() => {
            shutdownComplete = true;
            resolve();
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Checkout callback assertion failed"));
        }
      });
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(pool.totalCount).toBe(0);
    expect(DelayedClient.instances[0].endCalls).toBe(1);
    expect(shutdownComplete).toBe(false);

    await vi.advanceTimersByTimeAsync(49);
    expect(shutdownComplete).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await shutdown;

    await vi.advanceTimersByTimeAsync(50);
    expect(shutdownComplete).toBe(true);
    expect(DelayedClient.instances[0].endCalls).toBe(1);
  });

  test("keeps closing clients within the pool limit until their close completes", async () => {
    vi.useFakeTimers();
    const pool = new Pool({
      Client: DelayedClient as unknown as NonNullable<PoolConfig["Client"]>,
      connectionTimeoutMillis: 100,
      max: 1,
    });

    const firstConnection = pool.connect();
    const firstRejection = expect(firstConnection).rejects.toThrow(
      "Connection terminated due to connection timeout"
    );
    await vi.advanceTimersByTimeAsync(75);
    const secondConnection = pool.connect();
    let secondClient: PoolClient | undefined;
    const secondResult = secondConnection.then((client) => {
      secondClient = client;
    });

    await vi.advanceTimersByTimeAsync(25);
    await firstRejection;

    expect(pool.waitingCount).toBe(1);
    expect(DelayedClient.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(49);
    expect(DelayedClient.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(secondClient).toBeDefined();
    await secondResult;

    expect(DelayedClient.instances).toHaveLength(2);
    secondClient?.release();
    const shutdown = pool.end();
    await vi.advanceTimersByTimeAsync(50);
    await shutdown;
  });

  test("force closes a timed-out socket when graceful termination stalls", async () => {
    vi.useFakeTimers();
    const pool = new Pool({
      Client: StuckConnectionClient as unknown as NonNullable<PoolConfig["Client"]>,
      connectionTimeoutMillis: 100,
      max: 1,
    });

    const connection = pool.connect();
    const rejection = expect(connection).rejects.toThrow("Connection terminated due to connection timeout");

    await vi.advanceTimersByTimeAsync(100);
    await rejection;

    const client = StuckConnectionClient.instances[0];
    expect(client.connection.end).toHaveBeenCalledOnce();
    expect(client.connection.stream.destroy).not.toHaveBeenCalled();

    let shutdownComplete = false;
    const shutdown = pool.end().then(() => {
      shutdownComplete = true;
    });

    await vi.advanceTimersByTimeAsync(99);
    expect(shutdownComplete).toBe(false);
    expect(client.connection.stream.destroy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await shutdown;

    expect(client.connection.stream.destroy).toHaveBeenCalledOnce();
    expect(shutdownComplete).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(client.connection.stream.destroy).toHaveBeenCalledOnce();
  });
});
