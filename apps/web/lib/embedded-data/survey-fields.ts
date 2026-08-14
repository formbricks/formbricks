import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { type TSurveyVariable } from "@formbricks/types/surveys/types";

/**
 * The join that makes the `EmbeddedData` / `SurveyEmbeddedData` tables the read source of truth
 * (ENG-1837). Add it to a survey select and pass the row through {@link inlineSurveyEmbeddedFields};
 * every reader then resolves definitions through `getSurveyEmbeddedFields` instead of reading
 * `survey.variables` / `survey.hiddenFields`.
 *
 * Only the columns the read seam consumes are selected — this shape reaches public survey payloads
 * (the SDK workspace state and the link-survey page), so the row's ids, ownership and timestamps
 * stay server-side. It mirrors `SELECT_CURRENT_FIELDS` in reconcile.ts minus exactly those.
 *
 * `orderBy` is not optional: without it Postgres row order is unspecified, and this list drives
 * user-visible column and picker order. It is the tie-break, not the ordering rule — see
 * {@link inlineSurveyEmbeddedFields}.
 */
export const selectSurveyEmbeddedDataLinks = {
  select: {
    storageKey: true,
    embeddedData: {
      select: { name: true, source: true, dataType: true, defaultValue: true, locked: true },
    },
  },
  orderBy: { storageKey: "asc" },
} as const satisfies Prisma.SurveySelect["embeddedDataLinks"];

/** The shape {@link selectSurveyEmbeddedDataLinks} produces, as much of it as the mapping needs. */
interface TSurveyWithEmbeddedDataLinks {
  variables?: unknown;
  hiddenFields?: unknown;
  embeddedDataLinks?: {
    storageKey: string;
    embeddedData: TLinkedEmbeddedField["field"];
  }[];
}

/**
 * `variables` and `hiddenFields` are `Json` columns. Prisma types them from the schema annotation,
 * but nothing enforces that shape in the database, so a row can hold an object where an array
 * belongs. `toDesiredEmbeddedFields` maps both with `?? []`, which catches `null` and `undefined`
 * but not a wrong type — one malformed row would throw `(variables ?? []).map is not a function`
 * inside `transformPrismaSurvey` and fail the **entire survey read**, not just its ordering.
 *
 * Guarded here rather than inside `toDesiredEmbeddedFields`, because that mapper is shared with
 * `reconcileEmbeddedData` on the WRITE path, where throwing is the correct behaviour: silently
 * mapping a malformed survey to an empty desired set would delete every row it has. Reads must
 * degrade, writes must fail loudly — so the leniency belongs at this boundary and nowhere else.
 * (ENG-1835's `planSurveyBackfill` makes the same call from the other side: it checks these shapes
 * and skips the survey.)
 *
 * The two groups are guarded independently on purpose. A survey whose `variables` are malformed
 * still ranks its hidden fields correctly; only the malformed group loses its declared order and
 * sorts last. A blanket `try`/`catch` would lose both — and would also swallow a genuine bug inside
 * the mapper.
 */

/**
 * Not "is a valid variable list" — only that mapping over it cannot throw. Entries that are objects
 * but not variables yield a garbage `storageKey`, which simply matches no row and therefore ranks
 * nothing; entries that are `null` would throw on the property read, so they disqualify the list.
 */
const toRankableVariables = (value: unknown): TSurveyVariable[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "object" && entry !== null)
    ? (value as TSurveyVariable[])
    : [];

/** Non-string ids cannot be storage keys, so they are dropped rather than disqualifying the list. */
const toRankableFieldIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

/** Reads `hiddenFields.fieldIds` without assuming `hiddenFields` is an object at all. */
const readFieldIds = (hiddenFields: unknown): string[] =>
  toRankableFieldIds(
    typeof hiddenFields === "object" && hiddenFields !== null
      ? (hiddenFields as { fieldIds?: unknown }).fieldIds
      : undefined
  );

/**
 * Reshapes the joined rows into the `{ field, link }` pairs the read seam consumes, or `undefined`
 * when the select omitted the join — which is exactly the input `getSurveyEmbeddedFields`' fallback
 * expects, so a survey read through a narrower select keeps resolving off its legacy columns.
 *
 * **Ordering.** Neither table carries an ordinal column, so the rows cannot reproduce the order the
 * author put their variables and hidden fields in — and that order is user-visible: it is the CSV
 * and XLSX header order and the order of every picker. Until the legacy JSON columns are dropped
 * they therefore remain the source of truth for *order* while the rows are the source of truth for
 * *definitions*, which is what this sort expresses. A row whose storage key the columns don't know
 * (impossible today — `reconcileEmbeddedData` writes exactly the derived set in one plan) sorts last
 * rather than being dropped, in the select's `storageKey` order.
 */
export const inlineSurveyEmbeddedFields = (
  surveyPrisma: TSurveyWithEmbeddedDataLinks
): TLinkedEmbeddedField[] | undefined => {
  const links = surveyPrisma.embeddedDataLinks;
  if (!links) return undefined;

  // Still routed through `toDesiredEmbeddedFields` rather than reading the ids here: which key a
  // field is addressed by (a variable's cuid, a hidden field's name) is that function's rule, and
  // re-deriving it at this boundary is how the ordering would silently drift from the rows.
  const legacyRankByStorageKey = new Map(
    toDesiredEmbeddedFields({
      variables: toRankableVariables(surveyPrisma.variables),
      hiddenFields: { enabled: false, fieldIds: readFieldIds(surveyPrisma.hiddenFields) },
    }).map((field, index) => [field.storageKey, index] as const)
  );
  const rank = (storageKey: string): number =>
    legacyRankByStorageKey.get(storageKey) ?? Number.MAX_SAFE_INTEGER;

  // Array.prototype.sort is stable, so rows the columns don't rank keep the select's storageKey order.
  return links
    .map((link) => ({ field: link.embeddedData, link: { storageKey: link.storageKey } }))
    .sort((a, b) => rank(a.link.storageKey) - rank(b.link.storageKey));
};

/**
 * Replaces the raw `embeddedDataLinks` relation on a Prisma survey row with the inlined
 * `embeddedFields` the read seam consumes, so the relation shape never leaks onto `TSurvey`.
 * A no-op for rows read through a select without the join.
 */
export const withInlinedEmbeddedFields = <T extends TSurveyWithEmbeddedDataLinks>(
  surveyPrisma: T
): Omit<T, "embeddedDataLinks"> => {
  const { embeddedDataLinks: _links, ...rest } = surveyPrisma;
  const embeddedFields = inlineSurveyEmbeddedFields(surveyPrisma);
  return embeddedFields ? { ...rest, embeddedFields } : rest;
};
