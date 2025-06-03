import { TUser } from "@formbricks/types/user";

export type AuditLoggingCtx = {
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
  projectId?: string;
  languageId?: string;
  inviteId?: string;
  membershipId?: string;
  actionClassId?: string;
  contactId?: string;
  apiKeyId?: string;
  responseId?: string;
  responseNoteId?: string;
  teamId?: string;
  integrationId?: string;
};

export type ActionClientCtx = {
  auditLoggingCtx: AuditLoggingCtx;
  user?: TUser;
};

export type AuthenticatedActionClientCtx = ActionClientCtx & {
  user: TUser;
};
