import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";

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

  const legacyRankByStorageKey = new Map(
    toDesiredEmbeddedFields({
      variables: surveyPrisma.variables as Parameters<typeof toDesiredEmbeddedFields>[0]["variables"],
      hiddenFields: surveyPrisma.hiddenFields as Parameters<
        typeof toDesiredEmbeddedFields
      >[0]["hiddenFields"],
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
