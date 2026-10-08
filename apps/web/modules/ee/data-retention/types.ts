/** The kind of data a retention policy governs. Mirrors the `RetentionEntity` enum in the schema. */
export type TRetentionPolicyKind = "responses" | "surveys" | "members";

/**
 * A History row as `GET /api/internal/retention-runs` returns it (ENG-3695). For the members policy,
 * `archived` counts deactivated members.
 */
export type TRetentionRun = {
  id: string;
  policy: TRetentionPolicyKind;
  startedAt: string;
  finishedAt: string | null;
  notified: number;
  archived: number;
  deleted: number;
  skipped: number;
};

/** The policies a survey can be exempted from. Members can't be exempted (ENG-3346). */
export const RETENTION_EXEMPTION_POLICIES = ["surveys", "responses"] as const;
export type TRetentionExemptionPolicy = (typeof RETENTION_EXEMPTION_POLICIES)[number];

/** An exemption's reason, at most this long once trimmed. */
export const RETENTION_EXEMPTION_REASON_MAX_LENGTH = 500;
/** How far ahead an exemption may end. Open-ended exemptions are out of scope (ENG-3346). */
export const RETENTION_EXEMPTION_MAX_YEARS = 10;

/**
 * An exemption as the `retention-exemptions` routes return it (ENG-3695). `until` is the instant it
 * ends; `revokedAt` is set once it is revoked, or closed after it ended.
 */
export type TRetentionExemption = {
  id: string;
  surveyId: string;
  surveyName: string;
  workspaceId: string;
  policy: TRetentionExemptionPolicy;
  until: string;
  reason: string;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  revokedAt: string | null;
};

/** `POST /api/internal/retention-exemptions` body. */
export type TCreateRetentionExemptionInput = {
  surveyId: string;
  policy: TRetentionExemptionPolicy;
  until: string;
  reason: string;
};

/** A survey the Add exemption picker offers. */
export type TRetentionExemptionSurveyOption = {
  id: string;
  name: string;
  workspaceName: string;
};
