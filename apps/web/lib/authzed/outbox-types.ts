import "server-only";

export const AUTHZED_OUTBOX_TARGET_TYPES = [
  "api_key",
  "api_key_workspace",
  "feedback_directory",
  "feedback_directory_assignment",
  "mcp_grant",
  "membership",
  "organization",
  "survey",
  "team",
  "team_membership",
  "user",
  "workspace",
  "workspace_team",
] as const;

export type TAuthzedOutboxTargetType = (typeof AUTHZED_OUTBOX_TARGET_TYPES)[number];

export type TAuthzedOutboxEvent = Readonly<{
  attempts: number;
  createdAt: Date;
  id: string;
  isRevocation: boolean;
  primaryId: string;
  secondaryId: string | null;
  targetType: TAuthzedOutboxTargetType;
}>;

export type TAuthzedOutboxStatus = Readonly<{
  deadLettered: number;
  oldestPendingAgeSeconds: number | null;
  overdueRevocations: number;
  pending: number;
  revocationsPastCritical: number;
  revocationsPastWarning: number;
  /**
   * Undelivered rows of a target type this release doesn't know: a newer release's events this release
   * leaves to it, or corrupt rows no release will deliver. Excluded from every other count.
   */
  unknownType: number;
}>;

export type TAuthzedOutboxDrainResult = Readonly<{
  claimed: number;
  deadLettered: number;
  delivered: number;
  failed: number;
  remaining: number;
  status: "drained" | "partial";
}>;
