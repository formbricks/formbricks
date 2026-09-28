import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TResponsePipelineJobData } from "@formbricks/jobs";
import { resetDb } from "@/integration/reset-db";
import {
  clearProjectionScopeReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "@/lib/authzed/scope-readiness";
import { processResponsePipelineJob } from "@/modules/response-pipeline/lib/process-response-pipeline-job";
import { findNotWorkspaceVisibleSurveyIds } from "./outbound";

/**
 * ENG-3283, Gate F: against a real PostgreSQL, a response to a private survey enqueues no webhook
 * delivery — not even for a webhook subscribed to every survey in the workspace, which is the case the
 * attach-time guard cannot catch. Only the queue boundary is replaced, so the test observes enqueues.
 */
const enqueued = vi.hoisted(() => ({ jobs: [] as unknown[] }));

vi.mock("@formbricks/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@formbricks/jobs")>()),
  enqueueWebhookDeliveryJob: async (payload: unknown) => {
    enqueued.jobs.push(payload);
    return { id: `job-${enqueued.jobs.length}` };
  },
}));
vi.mock("@/lib/telemetry/usage-update", () => ({ sendTelemetryEvents: async () => undefined }));

const ids = { privateSurvey: "", visibleSurvey: "", workspace: "" };

const pipelineData = async (surveyId: string): Promise<TResponsePipelineJobData> => {
  const response = await prisma.response.create({ data: { data: {}, finished: false, surveyId } });
  return {
    event: "responseCreated",
    response: {
      contact: null,
      contactAttributes: null,
      createdAt: response.createdAt,
      data: {},
      displayId: null,
      endingId: null,
      finished: false,
      id: response.id,
      language: null,
      meta: {},
      singleUseId: null,
      surveyId,
      tags: [],
      updatedAt: response.updatedAt,
      variables: {},
    },
    surveyId,
    workspaceId: ids.workspace,
  } as TResponsePipelineJobData;
};

const context = {
  attempt: 1,
  jobId: "job",
  jobName: "response-pipeline.process",
  maxAttempts: 3,
  queueName: "q",
};

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Outbound Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Outbound", organizationId: organization.id },
  });
  ids.workspace = workspace.id;

  ids.visibleSurvey = (
    await prisma.survey.create({
      data: { name: "Visible", visibility: "workspace", workspaceId: workspace.id },
    })
  ).id;
  ids.privateSurvey = (
    await prisma.survey.create({
      data: { name: "Private", visibility: "private", workspaceId: workspace.id },
    })
  ).id;

  // `surveyIds: []` subscribes the webhook to every survey in the workspace.
  await prisma.webhook.create({
    data: {
      source: "user",
      surveyIds: [],
      triggers: ["responseCreated"],
      url: "https://receiver.example.com/hook",
      workspaceId: workspace.id,
    },
  });

  await setProjectionScopeReady("survey", "integration");
  resetSurveyVisibilityReadinessMemo();
}, 120_000);

beforeEach(() => {
  enqueued.jobs = [];
});

afterAll(async () => {
  await clearProjectionScopeReady("survey");
  resetSurveyVisibilityReadinessMemo();
});

describe("outbound plumbing with survey visibility enforced", () => {
  test("a wildcard webhook still receives a workspace-visible survey's responses", async () => {
    await processResponsePipelineJob(await pipelineData(ids.visibleSurvey), context);
    expect(enqueued.jobs).toHaveLength(1);
  });

  test("a private survey's response enqueues no delivery, even for a wildcard webhook", async () => {
    await processResponsePipelineJob(await pipelineData(ids.privateSurvey), context);
    expect(enqueued.jobs).toHaveLength(0);
  });

  test("the attach-time lookup names exactly the private survey", async () => {
    await expect(findNotWorkspaceVisibleSurveyIds([ids.visibleSurvey, ids.privateSurvey])).resolves.toEqual([
      ids.privateSurvey,
    ]);
  });
});
