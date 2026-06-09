import { z } from "zod";

export const WORKFLOW_AUDIT_TARGETS = ["workflow", "workflowVersion", "workflowRun"] as const;

export const WORKFLOW_AUDIT_ACTIONS = [
  "created",
  "updated",
  "archived",
  "unarchived",
  "enabled",
  "disabled",
  "duplicated",
  "versionPublished",
  "dryRunCreated",
  "runFailed",
] as const;

export const WORKFLOW_ENTITY_AUDIT_ACTIONS = [
  "created",
  "updated",
  "archived",
  "unarchived",
  "enabled",
  "disabled",
  "duplicated",
] as const;

export const WORKFLOW_VERSION_AUDIT_ACTIONS = ["versionPublished"] as const;

export const WORKFLOW_RUN_AUDIT_ACTIONS = ["dryRunCreated", "runFailed"] as const;

export const AUDIT_TARGETS = [
  "organization",
  "project",
  "user",
  "team",
  "environment",
  "survey",
  "response",
  "contact",
  "membership",
  "apiKey",
  "webhook",
  "integration",
  ...WORKFLOW_AUDIT_TARGETS,
] as const;

export const AUDIT_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "archived",
  "unarchived",
  "enabled",
  "disabled",
  "duplicated",
  "published",
  "unpublished",
  "invited",
  "removed",
  "loggedIn",
  "loggedOut",
  "versionPublished",
  "dryRunCreated",
  "runFailed",
] as const;

export const ZAuditTarget = z.enum(AUDIT_TARGETS);
export type TAuditTarget = z.infer<typeof ZAuditTarget>;

export const ZWorkflowAuditTarget = z.enum(WORKFLOW_AUDIT_TARGETS);
export type TWorkflowAuditTarget = z.infer<typeof ZWorkflowAuditTarget>;

export const ZAuditAction = z.enum(AUDIT_ACTIONS);
export type TAuditAction = z.infer<typeof ZAuditAction>;

export const ZWorkflowAuditAction = z.enum(WORKFLOW_AUDIT_ACTIONS);
export type TWorkflowAuditAction = z.infer<typeof ZWorkflowAuditAction>;

export const ZWorkflowEntityAuditAction = z.enum(WORKFLOW_ENTITY_AUDIT_ACTIONS);
export type TWorkflowEntityAuditAction = z.infer<typeof ZWorkflowEntityAuditAction>;

export const ZWorkflowVersionAuditAction = z.enum(WORKFLOW_VERSION_AUDIT_ACTIONS);
export type TWorkflowVersionAuditAction = z.infer<typeof ZWorkflowVersionAuditAction>;

export const ZWorkflowRunAuditAction = z.enum(WORKFLOW_RUN_AUDIT_ACTIONS);
export type TWorkflowRunAuditAction = z.infer<typeof ZWorkflowRunAuditAction>;

export const ZAuditActorType = z.enum(["user", "apiKey", "system"]);
export type TAuditActorType = z.infer<typeof ZAuditActorType>;

export const ZAuditStatus = z.enum(["success", "failure"]);
export type TAuditStatus = z.infer<typeof ZAuditStatus>;

export const ZAuditActor = z.object({
  id: z.string().min(1),
  type: ZAuditActorType,
});
export type TAuditActor = z.infer<typeof ZAuditActor>;

export const ZAuditEventTarget = z.object({
  id: z.string().min(1).optional(),
  type: ZAuditTarget,
});
export type TAuditEventTarget = z.infer<typeof ZAuditEventTarget>;

export const ZAuditLogEvent = z.object({
  eventId: z.string().min(1).optional(),
  actor: ZAuditActor,
  action: ZAuditAction,
  target: ZAuditEventTarget,
  status: ZAuditStatus,
  organizationId: z.string().min(1),
  timestamp: z.iso.datetime(),
  ipAddress: z.string().optional(),
  apiUrl: z.url().optional(),
  changes: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TAuditLogEvent = z.infer<typeof ZAuditLogEvent>;

export const ZWorkflowAuditLogEventBase = ZAuditLogEvent.extend({
  target: z.object({
    id: z.string().min(1).optional(),
    type: ZWorkflowAuditTarget,
  }),
});

export const ZWorkflowEntityAuditLogEvent = ZWorkflowAuditLogEventBase.extend({
  action: ZWorkflowEntityAuditAction,
  target: z.object({
    id: z.string().min(1).optional(),
    type: z.literal("workflow"),
  }),
});

export const ZWorkflowVersionAuditLogEvent = ZWorkflowAuditLogEventBase.extend({
  action: ZWorkflowVersionAuditAction,
  target: z.object({
    id: z.string().min(1).optional(),
    type: z.literal("workflowVersion"),
  }),
});

export const ZWorkflowRunAuditLogEvent = ZWorkflowAuditLogEventBase.extend({
  action: ZWorkflowRunAuditAction,
  target: z.object({
    id: z.string().min(1).optional(),
    type: z.literal("workflowRun"),
  }),
});

export const ZWorkflowAuditLogEvent = z.union([
  ZWorkflowEntityAuditLogEvent,
  ZWorkflowVersionAuditLogEvent,
  ZWorkflowRunAuditLogEvent,
]);
export type TWorkflowAuditLogEvent = z.infer<typeof ZWorkflowAuditLogEvent>;

export const isWorkflowAuditTarget = (target: string): target is TWorkflowAuditTarget =>
  WORKFLOW_AUDIT_TARGETS.includes(target as TWorkflowAuditTarget);

export const isWorkflowAuditAction = (action: string): action is TWorkflowAuditAction =>
  WORKFLOW_AUDIT_ACTIONS.includes(action as TWorkflowAuditAction);
