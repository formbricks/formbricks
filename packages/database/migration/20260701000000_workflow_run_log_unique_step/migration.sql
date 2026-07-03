-- Enforce one WorkflowRunLog row per (runId, stepId) so retries/redeliveries UPDATE the existing step
-- row instead of inserting a duplicate. This backs the executor's per-step claim-before-send guard
-- (at-most-once email delivery).
CREATE UNIQUE INDEX "WorkflowRunLog_runId_stepId_key" ON "WorkflowRunLog"("runId", "stepId");
