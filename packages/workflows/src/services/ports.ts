import type { TWorkflowStatus } from "../types/common";
import type { TWorkflowDefinition } from "../types/document";
import type { TWorkflowRunStatus } from "../types/runs";

/**
 * Runtime ports the workflow server code depends on. They are injected by the adapter
 * (`apps/web`) so this package stays framework-agnostic and carries no dependency on
 * `@formbricks/database` — which itself imports `@formbricks/workflows`, so a hard edge back
 * would create a package build cycle.
 *
 * The row and delegate shapes are hand-authored from our own domain types (the row's
 * `definition`/`status` ARE our types) rather than imported from Prisma's generated client. This
 * keeps the package a dependency-free leaf; the adapter bridges the real Prisma client to these
 * ports (a single contained cast on the app side).
 */

/** A `Workflow` row, matching `packages/database/schema/workflows.prisma`. */
export interface WorkflowRow {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  status: TWorkflowStatus;
  workspaceId: string;
  createdBy: string | null;
  definition: TWorkflowDefinition;
}

/** The subset of `WorkflowRun` fields the list/detail serializers read for `lastRun`. */
export interface WorkflowRunRow {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  workflowId: string;
  workspaceId: string;
  workflowVersionId: string | null;
  responseId: string | null;
  status: TWorkflowRunStatus;
  triggerType: string;
  surveyId: string | null;
  isDryRun: boolean;
  attempt: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** A workflow row with its most recent run eagerly loaded (for `lastRun`). */
export type WorkflowRowWithLastRun = WorkflowRow & { runs: WorkflowRunRow[] };

/** Eager-load shape for the most recent run; matches the Prisma `include` the adapter satisfies. */
export interface LastRunInclude {
  runs: { take: number; orderBy: { createdAt: "desc" } };
}

/** Narrow `where` filter the service builds — a deliberately small slice of Prisma's WhereInput. */
export interface WorkflowWhereInput {
  workspaceId?: string;
  status?: TWorkflowStatus | { in: TWorkflowStatus[] } | { not: TWorkflowStatus };
  name?: { contains: string; mode: "insensitive" } | { gt: string } | string;
  id?: { gt: string } | { lt: string };
  createdAt?: { lt: Date } | Date;
  updatedAt?: { lt: Date } | Date;
  OR?: WorkflowWhereInput[];
}

export interface WorkflowOrderByInput {
  id?: "asc" | "desc";
  name?: "asc" | "desc";
  createdAt?: "asc" | "desc";
  updatedAt?: "asc" | "desc";
}

/**
 * The slice of `prisma.workflow` the service calls. The real Prisma delegate is structurally
 * broader; the adapter bridges it to this port.
 */
export interface WorkflowDelegate {
  findMany: (args: {
    where: WorkflowWhereInput;
    orderBy: WorkflowOrderByInput[];
    take: number;
    include: LastRunInclude;
  }) => Promise<WorkflowRowWithLastRun[]>;
  findUnique: (args: {
    where: { id: string };
    include: LastRunInclude;
  }) => Promise<WorkflowRowWithLastRun | null>;
  create: (args: {
    data: {
      workspaceId: string;
      name: string;
      description: string | null;
      status: TWorkflowStatus;
      definition: TWorkflowDefinition;
      createdBy: string | null;
    };
    include: LastRunInclude;
  }) => Promise<WorkflowRowWithLastRun>;
}

export interface WorkflowsDb {
  workflow: WorkflowDelegate;
}

/**
 * Minimal structural logger port. Satisfied by a request-bound `@formbricks/logger` child
 * (`logger.withContext({ requestId })`). The package never imports the logger package directly.
 */
export interface WorkflowsLogger {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}
