import { EventEmitter } from "node:events";
import { Pool, type PoolConfig } from "pg";
import { afterEach, describe, expect, test, vi } from "vitest";

class DelayedClient extends EventEmitter {
  static instances: DelayedClient[] = [];

  connection = undefined;
  ended = false;

  constructor() {
    super();
    DelayedClient.instances.push(this);
  }

  connect(callback: (error?: Error) => void): void {
    setTimeout(callback, 200);
  }

  end(callback?: () => void): void {
    this.ended = true;
    callback?.();
  }

  isConnected(): boolean {
    return false;
  }
}

afterEach(() => {
  DelayedClient.instances = [];
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
    await pool.end();
  });
});
