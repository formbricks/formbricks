-- Add a durable `dispatchedAt` marker to WorkflowRun: stamped by the producer/reconciler right after a
-- successful hand-off to the task backend. Lets recovery distinguish a genuine never-dispatched producer
-- orphan (`dispatchedAt IS NULL`) from a dispatched-but-still-queued run as a DB fact, rather than
-- inferring it from queue-level jobId dedup. Nullable; existing rows backfill to NULL (treated as
-- "dispatch status unknown" — recovery still re-dispatches them idempotently).
ALTER TABLE "WorkflowRun" ADD COLUMN "dispatchedAt" TIMESTAMP(3);
