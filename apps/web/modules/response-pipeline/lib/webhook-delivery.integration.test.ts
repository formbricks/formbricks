import { type Job, type JobsOptions, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  type JobHandlerOverrides,
  ONE_SHOT_JOB_NAMES,
  type TWebhookDeliveryJobData,
  startJobsRuntime,
} from "@formbricks/jobs";
import { resetDb } from "@/integration/reset-db";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { processWebhookDeliveryJob } from "./process-webhook-delivery-job";

// The receiver listens on 127.0.0.1, which the SSRF policy rejects by default. This is the same switch
// a self-hoster flips to deliver to internal services; the policy itself is covered by the unit suites.
vi.mock(import("@/lib/constants"), async (importOriginal) => ({
  ...(await importOriginal()),
  DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
}));

/**
 * Webhook fan-out delivery against a real Redis, a real BullMQ worker and a real Postgres row
 * (ENG-2337). The unit suites prove each piece in isolation; this proves the pieces agree — that a job
 * enqueued the way the pipeline enqueues it comes out of a worker as a correctly signed HTTP request,
 * that BullMQ's retry actually re-runs the handler with the same webhook-id, that a deterministic jobId
 * really dedupes at the queue, and that two worker processes sharing the queue deliver each job once.
 */

type TReceivedRequest = { path: string; headers: http.IncomingHttpHeaders; body: string };

const received: TReceivedRequest[] = [];
let failuresRemaining = 0;
let receiver: http.Server;
let receiverBaseUrl: string;

const startReceiver = async (): Promise<void> => {
  receiver = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      received.push({ path: req.url ?? "", headers: req.headers, body });
      if (req.url === "/gone") {
        res.writeHead(404).end();
        return;
      }
      if (req.url === "/flaky" && failuresRemaining > 0) {
        failuresRemaining -= 1;
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200).end("ok");
    });
  });
  await new Promise<void>((resolve) => {
    receiver.listen(0, "127.0.0.1", () => resolve());
  });
  receiverBaseUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;
};

const toOverride =
  (handler: typeof processWebhookDeliveryJob): NonNullable<JobHandlerOverrides[string]> =>
  async (data, context) => {
    await handler(data as TWebhookDeliveryJobData, context);
  };

type TRuntime = Awaited<ReturnType<typeof startJobsRuntime>>;

const startWorker = (redisUrl: string): Promise<TRuntime> =>
  startJobsRuntime({
    redisUrl,
    jobHandlerOverrides: { [ONE_SHOT_JOB_NAMES.webhookDelivery]: toOverride(processWebhookDeliveryJob) },
  });

let redisUrl: string;
let runtime: TRuntime;
let queueEvents: QueueEvents;
let queueEventsConnection: IORedis;

const seedWebhook = async (input: {
  path: string;
  secret: string | null;
  triggers?: ("responseCreated" | "responseUpdated" | "responseFinished")[];
  surveyIds?: string[];
}) => {
  const organization = await prisma.organization.create({ data: { name: "webhook fan-out" } });
  const workspace = await prisma.workspace.create({
    data: { name: "webhook fan-out", organizationId: organization.id },
  });
  return prisma.webhook.create({
    data: {
      url: `${receiverBaseUrl}${input.path}`,
      secret: input.secret,
      triggers: input.triggers ?? ["responseFinished"],
      surveyIds: input.surveyIds ?? [],
      workspaceId: workspace.id,
    },
  });
};

const SURVEY_ID = "clsurvey00000000000000001";

const buildPayload = (webhook: { id: string; workspaceId: string }): TWebhookDeliveryJobData => ({
  webhookId: webhook.id,
  workspaceId: webhook.workspaceId,
  surveyId: SURVEY_ID,
  event: "responseFinished",
  webhookMessageId: randomBytes(32).toString("hex"),
  response: {
    contact: null,
    contactAttributes: null,
    createdAt: new Date("2026-09-01T12:00:00.000Z"),
    data: { q1: "integration answer" },
    displayId: null,
    endingId: null,
    finished: true,
    id: `clresponse${randomBytes(7).toString("hex")}`,
    language: null,
    meta: {},
    singleUseId: null,
    surveyId: SURVEY_ID,
    tags: [],
    updatedAt: new Date("2026-09-01T12:00:00.000Z"),
    variables: {},
  },
  survey: {
    name: "Integration survey",
    type: "link",
    status: "inProgress",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-15T00:00:00.000Z"),
  },
});

/**
 * Enqueued through the runtime's own queue handle (closed with it) rather than the producer singleton, and
 * with a test-scoped retry policy: the production 30 s exponential backoff is pinned by the unit suite and
 * would make a retry test take minutes here.
 */
const enqueue = (payload: TWebhookDeliveryJobData, options: JobsOptions): Promise<Job> =>
  runtime.queue.add(ONE_SHOT_JOB_NAMES.webhookDelivery, payload, {
    attempts: 3,
    backoff: { type: "fixed", delay: 200 },
    ...options,
  });

const requestsTo = (path: string): TReceivedRequest[] => received.filter((request) => request.path === path);

describe("webhook delivery job (integration)", () => {
  beforeAll(async () => {
    redisUrl = process.env.REDIS_URL ?? "";
    expect(redisUrl, "REDIS_URL must be set by integration/setup.ts").not.toBe("");

    await startReceiver();
    runtime = await startWorker(redisUrl);
    queueEventsConnection = new IORedis(redisUrl, {
      connectionName: "formbricks-webhook-delivery-integration-events",
      maxRetriesPerRequest: null,
    });
    queueEvents = new QueueEvents(runtime.queue.name, {
      connection: queueEventsConnection,
      prefix: runtime.queue.opts.prefix,
    });
    await queueEvents.waitUntilReady();
  }, 30_000);

  afterAll(async () => {
    await queueEvents?.close();
    await queueEventsConnection?.quit();
    await runtime?.close();
    await new Promise<void>((resolve) => receiver?.close(() => resolve()));
  });

  beforeEach(async () => {
    received.length = 0;
    failuresRemaining = 0;
    await runtime.queue.obliterate({ force: true });
    await resetDb();
  });

  test("a queued delivery arrives as one signed Standard Webhooks request", async () => {
    const webhook = await seedWebhook({ path: "/ok", secret: "whsec_integration" });
    const payload = buildPayload(webhook);

    const job = await enqueue(payload, { jobId: `whd-int-${payload.webhookMessageId}` });
    await expect(job.waitUntilFinished(queueEvents)).resolves.toBeNull();

    const requests = requestsTo("/ok");
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.headers["webhook-id"]).toBe(payload.webhookMessageId);
    const timestamp = Number(request.headers["webhook-timestamp"]);
    expect(Math.abs(timestamp - Math.floor(Date.now() / 1000))).toBeLessThan(60);
    // The signature is over the exact bytes received, with the secret read from the database row.
    expect(request.headers["webhook-signature"]).toBe(
      generateStandardWebhookSignature(payload.webhookMessageId, timestamp, request.body, "whsec_integration")
    );
    expect(JSON.parse(request.body)).toMatchObject({
      webhookId: webhook.id,
      event: "responseFinished",
      data: {
        id: payload.response.id,
        data: { q1: "integration answer" },
        survey: { title: "Integration survey", type: "link", status: "inProgress" },
      },
    });
  }, 20_000);

  test("a failing receiver is retried by BullMQ with the same webhook-id", async () => {
    const webhook = await seedWebhook({ path: "/flaky", secret: null });
    const payload = buildPayload(webhook);
    failuresRemaining = 2;

    const job = await enqueue(payload, { jobId: `whd-int-${payload.webhookMessageId}` });
    await expect(job.waitUntilFinished(queueEvents)).resolves.toBeNull();

    const requests = requestsTo("/flaky");
    expect(requests).toHaveLength(3);
    expect(new Set(requests.map((request) => request.headers["webhook-id"]))).toEqual(
      new Set([payload.webhookMessageId])
    );
    expect(requests.every((request) => request.headers["webhook-signature"] === undefined)).toBe(true);
    const finished = await runtime.queue.getJob(job.id ?? "");
    expect(finished?.attemptsMade).toBe(3);
  }, 30_000);

  test("a receiver that rejects the request is not retried", async () => {
    const webhook = await seedWebhook({ path: "/gone", secret: null });
    const payload = buildPayload(webhook);

    const job = await enqueue(payload, { jobId: `whd-int-${payload.webhookMessageId}` });
    await expect(job.waitUntilFinished(queueEvents)).rejects.toThrow(/failed permanently/);

    expect(requestsTo("/gone")).toHaveLength(1);
    const failed = await runtime.queue.getJob(job.id ?? "");
    // UnrecoverableError: one attempt consumed out of three, then moved straight to failed.
    expect(failed?.attemptsMade).toBe(1);
    expect(await failed?.isFailed()).toBe(true);
  }, 20_000);

  test("re-enqueueing the same deterministic jobId is a no-op at the queue", async () => {
    const webhook = await seedWebhook({ path: "/ok", secret: null });
    const payload = buildPayload(webhook);
    const jobId = `whd-int-${payload.webhookMessageId}`;

    const first = await enqueue(payload, { jobId });
    const second = await enqueue(payload, { jobId });
    expect(second.id).toBe(first.id);
    await expect(first.waitUntilFinished(queueEvents)).resolves.toBeNull();
    // Give a phantom duplicate every chance to show up before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(requestsTo("/ok")).toHaveLength(1);
  }, 20_000);

  test("a webhook deleted while its delivery was queued is skipped", async () => {
    const webhook = await seedWebhook({ path: "/ok", secret: null });
    const payload = buildPayload(webhook);
    await prisma.webhook.delete({ where: { id: webhook.id } });

    const job = await enqueue(payload, { jobId: `whd-int-${payload.webhookMessageId}` });
    await expect(job.waitUntilFinished(queueEvents)).resolves.toBeNull();

    expect(received).toHaveLength(0);
  }, 20_000);

  test("two worker instances sharing the queue deliver every job exactly once", async () => {
    const secondRuntime = await startWorker(redisUrl);
    try {
      const webhook = await seedWebhook({ path: "/ok", secret: null });
      const payloads = Array.from({ length: 8 }, () => buildPayload(webhook));

      const jobs = await Promise.all(
        payloads.map((payload) => enqueue(payload, { jobId: `whd-int-${payload.webhookMessageId}` }))
      );
      await Promise.all(jobs.map((job) => job.waitUntilFinished(queueEvents)));

      const requests = requestsTo("/ok");
      expect(requests).toHaveLength(8);
      expect(new Set(requests.map((request) => request.headers["webhook-id"]))).toEqual(
        new Set(payloads.map((payload) => payload.webhookMessageId))
      );
    } finally {
      await secondRuntime.close();
    }
  }, 30_000);
});
