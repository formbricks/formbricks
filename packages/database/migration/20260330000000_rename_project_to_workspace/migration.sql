-- Rename enum
ALTER TYPE "ProjectTeamPermission" RENAME TO "WorkspaceTeamPermission";

-- Rename tables
ALTER TABLE "Project" RENAME TO "Workspace";
ALTER TABLE "ProjectTeam" RENAME TO "WorkspaceTeam";
ALTER TABLE "FeedbackRecordDirectoryProject" RENAME TO "FeedbackRecordDirectoryWorkspace";

-- Rename "Workspace" (was "Project") constraints and indexes
ALTER TABLE "Workspace" RENAME CONSTRAINT "Project_pkey" TO "Workspace_pkey";
ALTER TABLE "Workspace" RENAME CONSTRAINT "Project_organizationId_fkey" TO "Workspace_organizationId_fkey";
-- Note: Project_organizationId_idx was already dropped by 20260113160531_remove_unused_indexes
ALTER INDEX "Project_organizationId_name_key" RENAME TO "Workspace_organizationId_name_key";

-- Rename "Environment" column and constraints
ALTER TABLE "Environment" RENAME COLUMN "projectId" TO "workspaceId";
ALTER TABLE "Environment" RENAME CONSTRAINT "Environment_projectId_fkey" TO "Environment_workspaceId_fkey";
ALTER INDEX "Environment_projectId_idx" RENAME TO "Environment_workspaceId_idx";

-- Rename "Language" column and constraints
ALTER TABLE "Language" RENAME COLUMN "projectId" TO "workspaceId";
ALTER TABLE "Language" RENAME CONSTRAINT "Language_projectId_fkey" TO "Language_workspaceId_fkey";
ALTER INDEX "Language_projectId_code_key" RENAME TO "Language_workspaceId_code_key";

-- Rename "Survey" projectOverwrites column
ALTER TABLE "Survey" RENAME COLUMN "projectOverwrites" TO "workspaceOverwrites";

-- Rename "WorkspaceTeam" (was "ProjectTeam") columns and constraints
ALTER TABLE "WorkspaceTeam" RENAME COLUMN "projectId" TO "workspaceId";
ALTER TABLE "WorkspaceTeam" DROP CONSTRAINT "ProjectTeam_pkey";
ALTER TABLE "WorkspaceTeam" ADD CONSTRAINT "WorkspaceTeam_pkey" PRIMARY KEY ("workspaceId", "teamId");
ALTER TABLE "WorkspaceTeam" RENAME CONSTRAINT "ProjectTeam_projectId_fkey" TO "WorkspaceTeam_workspaceId_fkey";
ALTER TABLE "WorkspaceTeam" RENAME CONSTRAINT "ProjectTeam_teamId_fkey" TO "WorkspaceTeam_teamId_fkey";
ALTER INDEX "ProjectTeam_teamId_idx" RENAME TO "WorkspaceTeam_teamId_idx";

-- Rename "FeedbackRecordDirectoryWorkspace" (was "FeedbackRecordDirectoryProject") columns and constraints
ALTER TABLE "FeedbackRecordDirectoryWorkspace" RENAME COLUMN "projectId" TO "workspaceId";
ALTER TABLE "FeedbackRecordDirectoryWorkspace" DROP CONSTRAINT "FeedbackRecordDirectoryProject_pkey";
ALTER TABLE "FeedbackRecordDirectoryWorkspace" ADD CONSTRAINT "FeedbackRecordDirectoryWorkspace_pkey" PRIMARY KEY ("feedbackRecordDirectoryId", "workspaceId");
ALTER TABLE "FeedbackRecordDirectoryWorkspace" RENAME CONSTRAINT "FeedbackRecordDirectoryProject_feedbackRecordDirectoryId_fkey" TO "FeedbackRecordDirectoryWorkspace_feedbackRecordDirectoryId_fkey";
ALTER TABLE "FeedbackRecordDirectoryWorkspace" RENAME CONSTRAINT "FeedbackRecordDirectoryProject_projectId_fkey" TO "FeedbackRecordDirectoryWorkspace_workspaceId_fkey";
ALTER INDEX "FeedbackRecordDirectoryProject_projectId_idx" RENAME TO "FeedbackRecordDirectoryWorkspace_workspaceId_idx";
