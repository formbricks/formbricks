import "server-only";
import { prisma } from "@formbricks/database";
import { WORKFLOW_SAMPLE_TRIGGER_SOURCE } from "@formbricks/workflows";
import { createWorkflowRunJobHandler } from "./process-workflow-run-job";
import { createTestRunEffects } from "./test-run-effects";

/**
 * Runs a saved Test run inside the request (ENG-7181, ADR 0049): the same job handler and walker as a
 * real run, with fake effects, against the workflow's draft (a Test run has no version, so the handler
 * reads the live definition). One attempt: a failed step fails the run, never the request. The run is
 * never queued, so no worker can pick it up with the live effects, and the reconcilers skip dry runs.
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
  // Each HTTP request step's last Test request response, for "Wait and use it" (ENG-7179). One query.
  const samples = await prisma.workflowSample.findMany({
    where: { workflowId, workspaceId, source: { not: WORKFLOW_SAMPLE_TRIGGER_SOURCE } },
    select: { source: true, sample: true },
  });
  const effects = createTestRunEffects(new Map(samples.map((row) => [row.source, row.sample])));

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
