import { Queue, QueueEvents, Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { createProducerConnection, createWorkerConnection } from "./connection";

// Only the disposable loopback Redis started by verify-redis-tls.mjs may run this test.
const redisUrl = process.env.REDIS_TLS_TEST_URL;

test.skipIf(!redisUrl)(
  "producer, worker, and blocking event connections process work over verified Redis TLS",
  async () => {
    expect(new URL(redisUrl!).hostname).toBe("127.0.0.1");
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).not.toBe("0");
    const prefix = `{tls-test-${randomUUID()}}`;
    const producer = createProducerConnection({ redisUrl: redisUrl! });
    const workerConnection = createWorkerConnection({ redisUrl: redisUrl! });
    const eventConnection = workerConnection.duplicate();
    const queue = new Queue("tls-canary", { connection: producer, prefix });
    const events = new QueueEvents("tls-canary", { connection: eventConnection, prefix });
    const worker = new Worker<{ value: string }, string>(
      "tls-canary",
      (job) => Promise.resolve(job.data.value),
      {
        connection: workerConnection,
        prefix,
      }
    );
    try {
      await Promise.all([queue.waitUntilReady(), events.waitUntilReady(), worker.waitUntilReady()]);
      const job = await queue.add("canary", { value: "verified-tls" });
      expect(await job.waitUntilFinished(events, 5000)).toBe("verified-tls");
      expect(await queue.getFailedCount()).toBe(0);
    } finally {
      await worker.close();
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
      producer.disconnect();
      workerConnection.disconnect();
      eventConnection.disconnect();
    }
  },
  15000
);
