-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'enabled', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "WorkflowRunLogStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'draft',
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT,
    "definition" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by" TEXT,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workflowVersionId" TEXT,
    "responseId" TEXT,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'queued',
    "triggerEvent" TEXT NOT NULL,
    "surveyId" TEXT,
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "triggerPayload" JSONB NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRunLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "status" "WorkflowRunLogStatus" NOT NULL DEFAULT 'pending',
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_id_workspaceId_key" ON "Workflow"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_workspaceId_name_not_archived_key" ON "Workflow"("workspaceId", "name") WHERE "status" <> 'archived';

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_status_idx" ON "Workflow"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_updated_at_idx" ON "Workflow"("workspaceId", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_version_key" ON "WorkflowVersion"("workflowId", "version");

-- CreateIndex
CREATE INDEX "WorkflowVersion_workflowId_workspaceId_idx" ON "WorkflowVersion"("workflowId", "workspaceId");

-- CreateIndex
CREATE INDEX "WorkflowVersion_published_by_idx" ON "WorkflowVersion"("published_by");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_workflowId_idempotencyKey_key" ON "WorkflowRun"("workflowId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkflowRun_workspaceId_created_at_idx" ON "WorkflowRun"("workspaceId", "created_at");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_workspaceId_created_at_idx" ON "WorkflowRun"("workflowId", "workspaceId", "created_at");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_created_at_idx" ON "WorkflowRun"("status", "created_at");

-- CreateIndex
CREATE INDEX "WorkflowRun_responseId_idx" ON "WorkflowRun"("responseId");

-- CreateIndex
CREATE INDEX "WorkflowRun_isDryRun_idx" ON "WorkflowRun"("isDryRun");

-- CreateIndex
CREATE INDEX "WorkflowRun_nextAttemptAt_idx" ON "WorkflowRun"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "WorkflowRunLog_runId_sequence_idx" ON "WorkflowRunLog"("runId", "sequence");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_workspaceId_fkey" FOREIGN KEY ("workflowId", "workspaceId") REFERENCES "Workflow"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_workspaceId_fkey" FOREIGN KEY ("workflowId", "workspaceId") REFERENCES "Workflow"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRunLog" ADD CONSTRAINT "WorkflowRunLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
