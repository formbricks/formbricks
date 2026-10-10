import { Prisma } from "@formbricks/database/prisma";
import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";

/** Prisma unique-constraint violation code. */
const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * Type guard for a Prisma P2002 unique-constraint violation.
 *
 * Matches on the stable `error.code`, never on `error.meta` (which is not public API — see
 * `getUniqueConstraintFields`). Uses the *named* `PrismaClientKnownRequestError` type for the
 * predicate so the negative branch of the guard doesn't collapse to `never`.
 */
export const isUniqueConstraintError = (error: unknown): error is PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION;

/**
 * Strips one symmetric pair of double quotes from a column name.
 *
 * Before 7.10, `@prisma/adapter-pg` derived the column list by regex-scraping the Postgres error
 * DETAIL (`Key ("surveyId", "singleUseId")=(…)`) and never unquoted it; 7.10+ only does so when
 * Postgres reports no constraint name. Postgres quotes any identifier
 * `quote_identifier()` does not consider safe to leave bare — not all-lowercase, starting with a
 * digit, containing anything outside `[a-z0-9_]`, or colliding with a keyword — so `singleUseId`
 * arrives as `"singleUseId"` while `token_hash` arrives bare. (`quote_all_identifiers = on` quotes
 * everything, which this also handles.)
 *
 * Only a matched outer pair is removed, so already-bare names pass through byte-identical. Applied
 * to the legacy `meta.target` shape too: that engine does not quote, but running both branches
 * through the same normaliser keeps the two interchangeable for callers and tests.
 */
const unquoteIdentifier = (field: string): string =>
  field.length >= 2 && field.startsWith('"') && field.endsWith('"') ? field.slice(1, -1) : field;

const toColumnNames = (fields: unknown[]): string[] =>
  fields.filter((field): field is string => typeof field === "string").map(unquoteIdentifier);

/**
 * Database columns of the unique indexes whose name Prisma's default rule cannot round-trip:
 * composite or non-`id` primary keys, columns containing `_`, names Postgres truncated to 63 bytes,
 * and hand-written partial indexes whose name describes their predicate. Every other unique index is named `${table}_${column1}_…_${columnN}_key` and is parsed by
 * `columnsFromIndexName`. `prisma-constraint.integration.test.ts` checks this against every unique
 * index in the live schema, so an index added without an entry here fails CI instead of silently
 * resolving to the wrong columns.
 */
const UNIQUE_INDEX_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  AuthzedProjectionScopeState_pkey: ["scope"],
  FeedbackDirectoryWorkspace_pkey: ["feedbackDirectoryId", "workspaceId"],
  FeedbackSourceFieldMapping_workspaceId_feedbackSourceId_sourceF: [
    "workspaceId",
    "feedback_source_id",
    "source_field_id",
    "target_field_id",
  ],
  FeedbackSourceFormbricksMapping_workspaceId_feedbackSourceId_su: [
    "workspaceId",
    "feedback_source_id",
    "surveyId",
    "elementId",
  ],
  Membership_pkey: ["userId", "organizationId"],
  OrganizationBilling_pkey: ["organization_id"],
  OrganizationBilling_stripe_customer_id_key: ["stripe_customer_id"],
  PasswordResetToken_token_hash_key: ["token_hash"],
  ResponseQuotaLink_pkey: ["responseId", "quotaId"],
  // Partial (`WHERE "revokedAt" IS NULL`): the `active` suffix names the predicate, not a column.
  RetentionExemption_surveyId_entity_active_key: ["surveyId", "entity"],
  SurveyLanguage_pkey: ["languageId", "surveyId"],
  TagsOnResponses_pkey: ["responseId", "tagId"],
  TeamUser_pkey: ["teamId", "userId"],
  WorkspaceTeam_pkey: ["workspaceId", "teamId"],
};

const columnsFromIndexName = (index: string, table: unknown): string[] => {
  // Own properties only: a constraint named after an Object.prototype member must not resolve to it.
  if (Object.hasOwn(UNIQUE_INDEX_COLUMNS, index)) return [...UNIQUE_INDEX_COLUMNS[index]];
  if (typeof table !== "string") return [];
  if (index === `${table}_pkey`) return ["id"];

  const prefix = `${table}_`;
  const suffix = "_key";
  if (!index.startsWith(prefix) || !index.endsWith(suffix)) return [];

  const columns = index.slice(prefix.length, -suffix.length).split("_");
  return columns.every((column) => column !== "") ? columns : [];
};

/**
 * Returns the column names involved in a P2002 unique-constraint violation.
 *
 * Prisma's `error.meta` shape is explicitly NOT public API (prisma#28953) and differs by engine and
 * version:
 *  - library / legacy query engine: `meta.target` is a `string[]`
 *  - `@prisma/adapter-pg` before 7.10: `meta.driverAdapterError.cause.constraint.fields`, scraped
 *    from the Postgres DETAIL and possibly quoted
 *  - `@prisma/adapter-pg` 7.10+ (prisma#29587): `cause.constraint.index` holds the constraint name
 *    whenever Postgres reports one — which it always does — and `cause.table` the table; the
 *    column list is no longer passed through
 *
 * We read all three, in that order — this is the ONLY place in the codebase that touches the
 * unstable shape. Returns `[]` when none resolves (callers must still map P2002 to a
 * conflict/domain error, never a 500).
 *
 * Security: only the structured column names are returned. Never surface the constraint name or any
 * other raw `driverAdapterError.cause` field to a response or log — the Postgres DETAIL behind a
 * violation carries the offending values (PII), and unmapped errors pass it through as
 * `cause.detail`.
 */
export const getUniqueConstraintFields = (error: PrismaClientKnownRequestError): string[] => {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: {
          cause?: { constraint?: { fields?: unknown; index?: unknown }; table?: unknown };
        };
      }
    | undefined;

  // Legacy / library-engine shape.
  const legacyTarget = meta?.target;
  if (Array.isArray(legacyTarget)) {
    return toColumnNames(legacyTarget);
  }

  const cause = meta?.driverAdapterError?.cause;

  // Driver-adapter shape before 7.10.
  const adapterFields = cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) {
    return toColumnNames(adapterFields);
  }

  // Driver-adapter shape from 7.10.
  const index = cause?.constraint?.index;
  if (typeof index === "string") {
    return columnsFromIndexName(index, cause?.table);
  }

  return [];
};
