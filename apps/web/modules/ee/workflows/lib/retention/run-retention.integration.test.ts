import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ZWorkflowRunData, ZWorkflowTriggerRunPayload } from "@formbricks/workflows";
import { resetDb } from "@/integration/reset-db";
import { getOrganizationUsage } from "@/modules/organization/usage/lib/usage";
import { runWorkflowRunRetention } from "./run-retention";

vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsWorkflowsEnabled: vi.fn(async () => true) }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("workflow run retention (real Postgres)", () => {
  let organizationId: string;
  let workspaceId: string;
  let workflowId: string;

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "ACME Inc." } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Retail Banking", organizationId } })).id;
    workflowId = (
      await prisma.workflow.create({
        data: { name: "Notify the team", workspaceId, definition: { nodes: [], edges: [] } as never },
      })
    ).id;
  });

  const addRun = async ({
    finishedDaysAgo,
    createdDaysAgo = finishedDaysAgo ?? 1,
    isDryRun = false,
    webhook = true,
  }: {
    finishedDaysAgo: number | null;
    createdDaysAgo?: number;
    isDryRun?: boolean;
    webhook?: boolean;
  }) => {
    const triggeredAt = ago(createdDaysAgo).toISOString();
    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        workspaceId,
        isDryRun,
        status: finishedDaysAgo === null ? "running" : "failed",
        triggerType: webhook ? "webhook" : "response.completed",
        triggerPayload: (webhook
          ? { type: "webhook", workspaceId, payload: { email: "jane@example.com" }, triggeredAt }
          : {
              type: "response.completed",
              workspaceId,
              surveyId: "clsurvey0000000000000000",
              responseId: "clresponse00000000000000",
              data: { email: "jane@example.com" },
              triggeredAt,
            }) as never,
        data: { steps: [{ stepId: "send", stepType: "send_email", status: "failed" }] } as never,
        error: "Could not send to jane@example.com",
        callerIp: webhook ? "203.0.113.7" : null,
        createdAt: ago(createdDaysAgo),
        startedAt: ago(createdDaysAgo),
        finishedAt: finishedDaysAgo === null ? null : ago(finishedDaysAgo),
        logs: {
          create: {
            sequence: 0,
            stepId: "send",
            stepType: "send_email",
            status: "failed",
            input: { to: "jane@example.com" },
            output: { recipient: "jane@example.com" },
            error: "Mailbox jane@example.com is full",
          },
        },
      },
    });
    return run.id;
  };

  const readRun = (id: string) => prisma.workflowRun.findUnique({ where: { id }, include: { logs: true } });

  test("clears an old run's content and keeps its record", async () => {
    const webhookRun = await addRun({ finishedDaysAgo: 91 });
    const responseRun = await addRun({ finishedDaysAgo: 120, webhook: false });
    const before = await readRun(webhookRun);

    const result = await runWorkflowRunRetention({ now: NOW, retentionDays: 90 });

    expect(result.runContentCleared).toBe(2);
    const after = await readRun(webhookRun);
    expect(after).toMatchObject({
      status: "failed",
      triggerType: "webhook",
      workflowId,
      workspaceId,
      createdAt: before?.createdAt,
      startedAt: before?.startedAt,
      finishedAt: before?.finishedAt,
      updatedAt: before?.updatedAt,
      error: null,
      callerIp: null,
      contentDeletedAt: NOW,
      contentRetentionDays: 90,
    });
    expect(after?.triggerPayload).toEqual({
      type: "webhook",
      workspaceId,
      payload: {},
      triggeredAt: ago(91).toISOString(),
    });
    expect(after?.data).toEqual({});
    expect(after?.logs).toEqual([
      expect.objectContaining({ status: "failed", input: {}, output: {}, error: null }),
    ]);
    // The run resource still parses what is left.
    expect(ZWorkflowTriggerRunPayload.safeParse(after?.triggerPayload).success).toBe(true);
    expect(ZWorkflowRunData.safeParse(after?.data).success).toBe(true);

    const response = await readRun(responseRun);
    expect(response?.triggerPayload).toEqual({
      type: "response.completed",
      workspaceId,
      surveyId: "clsurvey0000000000000000",
      responseId: "clresponse00000000000000",
      triggeredAt: ago(120).toISOString(),
    });
    expect(ZWorkflowTriggerRunPayload.safeParse(response?.triggerPayload).success).toBe(true);
  });

  test("keeps the content of recent runs and of runs that have not finished", async () => {
    const recent = await addRun({ finishedDaysAgo: 89 });
    const unfinished = await addRun({ finishedDaysAgo: null, createdDaysAgo: 200 });

    await runWorkflowRunRetention({ now: NOW, retentionDays: 90 });

    for (const id of [recent, unfinished]) {
      const run = await readRun(id);
      expect(run?.contentDeletedAt).toBeNull();
      expect(run?.callerIp).toBe("203.0.113.7");
      expect(run?.logs[0].input).toEqual({ to: "jane@example.com" });
    }
  });

  test("is safe to rerun: a second pass changes nothing", async () => {
    const id = await addRun({ finishedDaysAgo: 100 });
    await runWorkflowRunRetention({ now: NOW, retentionDays: 90 });
    const first = await readRun(id);

    const later = new Date(NOW.getTime() + DAY);
    const result = await runWorkflowRunRetention({ now: later, retentionDays: 30 });

    expect(result.runContentCleared).toBe(0);
    expect(await readRun(id)).toEqual(first);
  });

  test("drains in bounded batches", async () => {
    for (let i = 0; i < 5; i += 1) await addRun({ finishedDaysAgo: 100 + i });

    const first = await runWorkflowRunRetention({ now: NOW, retentionDays: 90, batchSize: 2, maxBatches: 2 });
    const second = await runWorkflowRunRetention({
      now: NOW,
      retentionDays: 90,
      batchSize: 2,
      maxBatches: 2,
    });

    expect(first.runContentCleared).toBe(4);
    expect(second.runContentCleared).toBe(1);
  });

  test("leaves usage counts for an old range unchanged", async () => {
    await addRun({ finishedDaysAgo: 100 });
    await addRun({ finishedDaysAgo: 120, webhook: false });
    await addRun({ finishedDaysAgo: 5 });
    const usage = () =>
      getOrganizationUsage({
        organizationId,
        range: { from: ago(365), to: ago(30) },
        timeZone: "UTC",
        now: NOW,
      });
    const before = await usage();
    expect(before.totals.workflowRunCount).toBe(2);

    await runWorkflowRunRetention({ now: NOW, retentionDays: 90 });

    expect(await usage()).toEqual(before);
  });

  test("deletes Test runs older than 7 days and keeps newer ones", async () => {
    const old = await addRun({ finishedDaysAgo: 8, isDryRun: true });
    const fresh = await addRun({ finishedDaysAgo: 6, isDryRun: true });

    const result = await runWorkflowRunRetention({ now: NOW, retentionDays: 90 });

    expect(result.testRunsDeleted).toBe(1);
    expect(await readRun(old)).toBeNull();
    expect(await prisma.workflowRunLog.count({ where: { runId: old } })).toBe(0);
    expect(await readRun(fresh)).not.toBeNull();
  });

  test("deletes samples not updated for the retention period", async () => {
    const stale = await prisma.workflowSample.create({
      data: { workflowId, workspaceId, source: "trigger", sample: { email: "jane@example.com" } as never },
    });
    const fresh = await prisma.workflowSample.create({
      data: { workflowId, workspaceId, source: "http-step", sample: {} as never },
    });
    // `updatedAt` is client-managed by Prisma, so age the row directly.
    await prisma.$executeRaw`UPDATE "WorkflowSample" SET "updated_at" = ${ago(91)} WHERE "id" = ${stale.id}`;

    const result = await runWorkflowRunRetention({ now: NOW, retentionDays: 90 });

    expect(result.samplesDeleted).toBe(1);
    expect(await prisma.workflowSample.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await prisma.workflowSample.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });
});
