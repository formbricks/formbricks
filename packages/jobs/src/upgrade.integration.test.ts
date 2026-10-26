import { QueueEvents, Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { expect, test } from "vitest";
import { createWorkerConnection } from "./connection";
import { JOBS_QUEUE_NAME } from "./constants";
import { createJobsQueue } from "./queue";
import { openJobsUpgradeQueue } from "./upgrade";

// A separate opt-in URL prevents ordinary unit runs from touching application Redis data.
const redisUrl = process.env.ONLINE_UPGRADE_TEST_REDIS_URL;

test.skipIf(!redisUrl)(
  "HTTP can enqueue during a pause; active source work finishes and target workers consume every queued job",
  async () => {
    const prefix = `{handoff-test-${randomUUID()}}`;
    const connection = createWorkerConnection({ redisUrl: redisUrl! });
    const queue = createJobsQueue({ connection, prefix });
    const events = new QueueEvents(JOBS_QUEUE_NAME, { connection, prefix });
    const control = await openJobsUpgradeQueue(redisUrl!, prefix);
    let releaseActive!: () => void;
    const activeGate = new Promise<void>((resolve) => {
      releaseActive = resolve;
    });
    let started!: () => void;
    const activeStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const sourceCompleted: string[] = [];
    const targetCompleted: string[] = [];
    const source = new Worker(
      JOBS_QUEUE_NAME,
      async (job) => {
        started();
        await activeGate;
        sourceCompleted.push(job.id!);
      },
      { connection, prefix }
    );
    let target: Worker | undefined;
    const http = createServer((_req, res) => {
      void queue
        .add("during-pause", {}, { jobId: "submitted-during-pause" })
        .then(() => {
          res.writeHead(202);
          res.end("accepted");
        })
        .catch(() => {
          res.writeHead(500);
          res.end();
        });
    });
    try {
      await Promise.all([events.waitUntilReady(), source.waitUntilReady()]);
      await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
      const active = await queue.add("source-active", {}, { jobId: "source-active" });
      await activeStarted;
      await control.pause();
      expect(await control.active()).toBe(1);
      const address = http.address();
      if (!address || typeof address === "string") throw new Error("fixture_address_missing");
      expect((await fetch(`http://127.0.0.1:${address.port}`)).status).toBe(202);
      const delayed = await queue.add("delayed", {}, { jobId: "handoff-delayed", delay: 50 });
      expect(await control.isPaused()).toBe(true);
      expect(await queue.getJobState("submitted-during-pause")).toBe("waiting");
      releaseActive();
      await active.waitUntilFinished(events, 5000);
      expect(await control.active()).toBe(0);
      await source.close();
      target = new Worker(
        JOBS_QUEUE_NAME,
        (job) => {
          targetCompleted.push(job.id!);
          return Promise.resolve();
        },
        { connection, prefix }
      );
      await target.waitUntilReady();
      const submitted = await queue.getJob("submitted-during-pause");
      expect(submitted).toBeDefined();
      await control.resume();
      await Promise.all([
        submitted!.waitUntilFinished(events, 5000),
        delayed.waitUntilFinished(events, 5000),
      ]);
      expect(sourceCompleted).toEqual(["source-active"]);
      expect(targetCompleted.sort()).toEqual(["handoff-delayed", "submitted-during-pause"]);
      expect(await queue.getFailedCount()).toBe(0);
    } finally {
      releaseActive();
      http.close();
      if (http.listening) await once(http, "close");
      await Promise.all([source.close(), target?.close()]);
      await control.close();
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
      await connection.quit();
    }
  },
  15000
);
