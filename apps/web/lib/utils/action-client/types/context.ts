import { TUser } from "@formbricks/types/user";

export type AuditLoggingCtx = {
  /**
   * Set by a handler when the action returned successfully but the audited thing did NOT happen, so
   * `withAuditLogging`'s fixed `action` would be a false record. The wrapper honours this only for a
   * SUCCESSFUL run — a handler that throws is always audited, so this can never hide a failure.
   *
   * The case it exists for: `createUserAction` answers a duplicate sign-up identically to a real one on
   * purpose (ENG-2099), so the wrapper cannot tell them apart and would log `created` for an account
   * that was never created (ENG-2091). Reach for it only where the action name itself becomes untrue,
   * not to quieten noisy events.
   */
  suppressEvent?: boolean;
  organizationId?: string;
  ipAddress: string;
  segmentId?: string;
  oldObject?: Record<string, unknown> | null;
  newObject?: Record<string, unknown> | null;
  eventId?: string;
  surveyId?: string;
  tagId?: string;
  webhookId?: string;
  userId?: string;
  workspaceId?: string;
  languageId?: string;
  inviteId?: string;
  membershipId?: string;
  actionClassId?: string;
  contactId?: string;
  apiKeyId?: string;
  responseId?: string;
  quotaId?: string;
  teamId?: string;
  integrationId?: string;
  chartId?: string;
  dashboardId?: string;
  dashboardWidgetId?: string;
  feedbackDirectoryId?: string;
  feedbackRecordId?: string;
};

export type ActionClientCtx = {
  auditLoggingCtx: AuditLoggingCtx;
  user?: TUser;
};

export type AuthenticatedActionClientCtx = ActionClientCtx & {
  user: TUser;
};
