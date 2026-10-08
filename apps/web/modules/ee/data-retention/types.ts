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
