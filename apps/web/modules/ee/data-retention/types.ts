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

/** What a survey must meet to be archived by the surveys policy; every condition ticked must hold. */
export const RETENTION_SURVEY_CONDITIONS = ["noResponse", "noChange", "createdBefore"] as const;
export type TRetentionSurveyCondition = (typeof RETENTION_SURVEY_CONDITIONS)[number];

/**
 * One policy's settings, all in days (ENG-3695). `null` means the step doesn't exist: responses have no
 * archive, members no delete. `conditions` is for the surveys policy only.
 */
export type TRetentionPolicySettings = {
  enabled: boolean;
  warnDays: number;
  archiveDays: number | null;
  deleteDays: number | null;
  conditions: TRetentionSurveyCondition[];
};

/** `GET /api/internal/retention-policies`: the organisation's three policies as one document. */
export type TRetentionPolicies = {
  responses: Omit<TRetentionPolicySettings, "conditions">;
  surveys: TRetentionPolicySettings;
  members: Omit<TRetentionPolicySettings, "conditions">;
};

/** `PATCH /api/internal/retention-policies`: exactly one policy, any of its fields. */
export type TRetentionPoliciesPatch =
  | { responses: Partial<Omit<TRetentionPolicySettings, "conditions">> }
  | { surveys: Partial<TRetentionPolicySettings> }
  | { members: Partial<Omit<TRetentionPolicySettings, "conditions">> };

/** What a policy does next to one survey, for its summary note and settings card (ENG-3695). */
export type TSurveyRetentionPolicy = {
  policy: TRetentionExemptionPolicy;
  /** An active exemption holds the survey from this policy, so it has no next date. */
  exempt: boolean;
  /** Null when the policy has nothing to do to this survey yet (no responses, or exempt). */
  nextAction: "archive" | "delete" | null;
  /** Never in the past: a step already due happens on the next nightly run, reported as the request time. */
  nextDate: string | null;
  /**
   * Responses policy: how many responses are already inside the warning window, the oldest deleted on
   * `nextDate`. Counted up to a cap, so `relation` says whether the number is exact.
   */
  dueCount: { count: number; relation: "eq" | "gte" } | null;
};

/** `GET /api/internal/survey-retention/{surveyId}`. `governed` is false without the entitlement too. */
export type TSurveyRetention = {
  governed: boolean;
  policies: TSurveyRetentionPolicy[];
  exemptions: TRetentionExemption[];
};

/**
 * What a survey page needs to show data retention, resolved on the server. Null when the organisation
 * isn't entitled: then the page renders nothing about retention and makes no request for it.
 */
export type TSurveyDataRetentionContext = {
  organizationId: string;
  /** The organisation's display time zone, so dates show as the day they fall on there. */
  timeZone: string;
  /** Owners and managers can exempt the survey from the page. */
  canExempt: boolean;
} | null;
