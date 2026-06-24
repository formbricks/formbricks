import type { TWorkflowStatus } from "../types/common";
import type { TWorkflowDefinition, TWorkflowExecutableDefinition } from "../types/document";
import type { TWorkflowRunStatus } from "../types/runs";

/**
 * Runtime ports the workflow server code depends on. They are injected by the adapter
 * (`apps/web`) so this package stays framework-agnostic and carries no dependency on
 * `@formbricks/database` — which itself imports `@formbricks/workflows`, so a hard edge back
 * would create a package build cycle.
 *
 * The row and delegate shapes are hand-authored from our own domain types (the row's
 * `definition`/`status` ARE our types) rather than imported from Prisma's generated client. This
 * keeps the package a dependency-free leaf; the real Prisma client structurally satisfies these
 * ports, so the adapter wires it in directly — no cast required.
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
  creator?: { name: string } | null;
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

/**
 * Eager-load shape for the most recent run plus the creating user's name; matches the Prisma
 * `include` the adapter satisfies. The `creator` relation (named in `workflows.prisma`) lets the
 * list/detail serializers emit `creator` without an extra query.
 */
export interface LastRunInclude {
  runs: { take: number; orderBy: { createdAt: "desc" } };
  creator: { select: { name: true } };
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
  update: (args: {
    where: { id_workspaceId: { id: string; workspaceId: string } };
    data: {
      name?: string;
      description?: string | null;
      status?: TWorkflowStatus;
      definition?: TWorkflowDefinition;
    };
    include: LastRunInclude;
  }) => Promise<WorkflowRowWithLastRun>;
  /**
   * Conditional status transition. `enable` uses it inside its transaction to flip a draft/disabled
   * row to enabled and assert exactly one row changed — the row lock serializes concurrent enables,
   * so the guard can't be bypassed the way a pre-transaction status read could.
   */
  updateMany: (args: {
    where: { id: string; workspaceId: string; status: { in: TWorkflowStatus[] } };
    data: { status: TWorkflowStatus };
  }) => Promise<{ count: number }>;
  delete: (args: {
    where: { id_workspaceId: { id: string; workspaceId: string } };
  }) => Promise<{ id: string }>;
}

/** A `WorkflowVersion` row (immutable executable snapshot), matching the Prisma schema. */
export interface WorkflowVersionRow {
  id: string;
  workflowId: string;
  workspaceId: string;
  version: number;
  definition: TWorkflowExecutableDefinition;
  publishedAt: Date;
  publishedBy: string | null;
}

/** The slice of `prisma.workflowVersion` the enable transaction calls. */
export interface WorkflowVersionDelegate {
  findFirst: (args: {
    where: { workflowId: string };
    orderBy: { version: "desc" };
    select: { version: true };
  }) => Promise<{ version: number } | null>;
  create: (args: {
    data: {
      workflowId: string;
      workspaceId: string;
      version: number;
      definition: TWorkflowExecutableDefinition;
      publishedBy: string | null;
    };
  }) => Promise<WorkflowVersionRow>;
}

/** Delegates available inside an interactive transaction (the subset enable needs to be atomic). */
export interface WorkflowsTransaction {
  workflow: WorkflowDelegate;
  workflowVersion: WorkflowVersionDelegate;
}

export interface WorkflowsDb {
  workflow: WorkflowDelegate;
  workflowVersion: WorkflowVersionDelegate;
  /** Interactive transaction; the real Prisma client's `$transaction` satisfies this structurally. */
  $transaction: <R>(fn: (tx: WorkflowsTransaction) => Promise<R>) => Promise<R>;
}

/**
 * Minimal structural logger port. Satisfied by a request-bound `@formbricks/logger` child
 * (`logger.withContext({ requestId })`). The package never imports the logger package directly.
 */
export interface WorkflowsLogger {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}
