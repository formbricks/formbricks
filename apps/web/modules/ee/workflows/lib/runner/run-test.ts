import "server-only";
import { prisma } from "@formbricks/database";
import { WORKFLOW_TRIGGER_SAMPLE_SOURCES, isLastTestSampleSource } from "@formbricks/workflows";
import { createWorkflowRunJobHandler } from "./process-workflow-run-job";
import { createTestRunEffects } from "./test-run-effects";

/**
 * Runs a saved Test run inside the request (ENG-7181, ADR 0049): the same job handler and walker as a
 * real run, with fake effects, against the workflow's draft (a Test run has no version, so the handler
 * reads the live definition). One attempt: a failed step fails the run, never the request. The run is
 * never queued, so no worker can pick it up with the live effects, and the reconcilers never queue it:
 * one this request leaves unfinished is failed after 10 minutes (`failInterruptedTestRuns`).
 */
export const executeWorkflowTestRun = async ({
  runId,
  workflowId,
  workspaceId,
}: {
  runId: string;
  workflowId: string;
  workspaceId: string;
}): Promise<void> => {
  // Each HTTP request step's expected response body, for "Wait and use it" (ENG-7179, ADR 0054). One query;
  // last Test request responses are left out, since only editors decide what a step answers with.
  const samples = await prisma.workflowSample.findMany({
    where: { workflowId, workspaceId, source: { notIn: [...WORKFLOW_TRIGGER_SAMPLE_SOURCES] } },
    select: { source: true, sample: true },
  });
  const effects = createTestRunEffects(
    new Map(
      samples.filter((row) => !isLastTestSampleSource(row.source)).map((row) => [row.source, row.sample])
    )
  );

  await createWorkflowRunJobHandler(effects)(
    { workflowRunId: runId, workflowId, workspaceId },
    {
      attempt: 1,
      maxAttempts: 1,
      jobId: `test-run:${runId}`,
      jobName: "workflow-test-run",
      queueName: "inline",
    }
  );
};
