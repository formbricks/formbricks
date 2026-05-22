-- CreateEnum
CREATE TYPE "public"."WorkflowStatus" AS ENUM ('draft', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "public"."WorkflowRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "public"."Workflow" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."WorkflowStatus" NOT NULL DEFAULT 'draft',
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT,
    "definition" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowRun" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "public"."WorkflowRunStatus" NOT NULL DEFAULT 'queued',
    "trigger_event" TEXT NOT NULL,
    "surveyId" TEXT,
    "responseId" TEXT,
    "trigger_payload" JSONB NOT NULL DEFAULT '{}',
    "data" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_id_workspaceId_key" ON "public"."Workflow"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_workspaceId_name_key" ON "public"."Workflow"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_status_idx" ON "public"."Workflow"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_updated_at_idx" ON "public"."Workflow"("workspaceId", "updated_at");

-- CreateIndex
CREATE INDEX "WorkflowRun_workspaceId_created_at_idx" ON "public"."WorkflowRun"("workspaceId", "created_at");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_workspaceId_created_at_idx" ON "public"."WorkflowRun"("workflowId", "workspaceId", "created_at");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_created_at_idx" ON "public"."WorkflowRun"("status", "created_at");

-- CreateIndex
CREATE INDEX "WorkflowRun_responseId_idx" ON "public"."WorkflowRun"("responseId");

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_workspaceId_fkey" FOREIGN KEY ("workflowId", "workspaceId") REFERENCES "public"."Workflow"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowRun" ADD CONSTRAINT "WorkflowRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowRun" ADD CONSTRAINT "WorkflowRun_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."Response"("id") ON DELETE SET NULL ON UPDATE CASCADE;
