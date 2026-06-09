import { z } from "zod";
import { ZWorkflowExecutableDefinition } from "./document";
import { ZWorkflowTriggerType } from "./triggers";

export const ZWorkflowRunStatus = z.enum(["queued", "running", "completed", "failed", "canceled"]);
export type TWorkflowRunStatus = z.infer<typeof ZWorkflowRunStatus>;

export const ZWorkflowRunLogStatus = z.enum(["pending", "running", "succeeded", "failed", "skipped"]);
export type TWorkflowRunLogStatus = z.infer<typeof ZWorkflowRunLogStatus>;

export const ZWorkflowTriggerRunPayload = z
  .object({
    type: ZWorkflowTriggerType,
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown())
  .describe("Trigger payload snapshot stored with a workflow run.");
export type TWorkflowTriggerRunPayload = z.infer<typeof ZWorkflowTriggerRunPayload>;

export const ZWorkflowRunLogInput = z.record(z.string(), z.unknown());
export type TWorkflowRunLogInput = z.infer<typeof ZWorkflowRunLogInput>;

export const ZWorkflowRunLogOutput = z.record(z.string(), z.unknown());
export type TWorkflowRunLogOutput = z.infer<typeof ZWorkflowRunLogOutput>;

export const ZWorkflowStepResult = z.object({
  stepId: z.string().min(1),
  stepType: z.string().min(1),
  status: ZWorkflowRunLogStatus,
  input: ZWorkflowRunLogInput.optional(),
  output: ZWorkflowRunLogOutput.optional(),
  error: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  finishedAt: z.coerce.date().optional(),
});
export type TWorkflowStepResult = z.infer<typeof ZWorkflowStepResult>;

export const ZWorkflowRunData = z
  .object({
    trigger: ZWorkflowTriggerRunPayload.optional(),
    steps: z.array(ZWorkflowStepResult).default([]),
  })
  .catchall(z.unknown());
export type TWorkflowRunData = z.infer<typeof ZWorkflowRunData>;

export const ZWorkflowVersion = z
  .object({
    id: z.cuid2(),
    workflowId: z.cuid2(),
    workspaceId: z.cuid2(),
    version: z.number().int().positive().describe("Monotonic workflow version number."),
    definition: ZWorkflowExecutableDefinition.describe("Immutable executable definition snapshot."),
    publishedAt: z.coerce.date(),
    publishedBy: z.cuid2().nullable().optional(),
  })
  .describe("Immutable workflow definition snapshot used by runs.");
export type TWorkflowVersion = z.infer<typeof ZWorkflowVersion>;

export const ZWorkflowRunLog = z
  .object({
    id: z.cuid2(),
    runId: z.cuid2(),
    sequence: z.number().int().nonnegative(),
    stepId: z.string().min(1),
    stepType: z.string().min(1),
    status: ZWorkflowRunLogStatus,
    input: ZWorkflowRunLogInput.optional(),
    output: ZWorkflowRunLogOutput.optional(),
    error: z.string().nullable().optional(),
    startedAt: z.coerce.date().nullable().optional(),
    finishedAt: z.coerce.date().nullable().optional(),
  })
  .describe("Persisted trace entry for one workflow run step.");
export type TWorkflowRunLog = z.infer<typeof ZWorkflowRunLog>;
