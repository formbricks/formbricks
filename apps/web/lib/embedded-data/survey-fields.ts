import "server-only";
import { Prisma } from "@formbricks/database/prisma";
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
 * **`orderBy` carries the entire ordering rule, and it has to live in the query.**
 * {@link withInlinedEmbeddedFields} only ever sees the rows the select returned, so a JS sort could
 * not recover an order the query never imposed. `storageKey` is the tiebreak rather than decoration:
 * `order` alone is not a total order, and `@@unique([surveyId, storageKey])` is what makes the pair
 * one. Every survey select that embeds this relation must use this constant, so that the order every
 * reader sees is decided in exactly one place.
 */
export const selectSurveyEmbeddedDataLinks = {
  select: {
    storageKey: true,
    embeddedData: {
      select: { name: true, source: true, dataType: true, defaultValue: true, locked: true },
    },
  },
  orderBy: [{ order: "asc" }, { storageKey: "asc" }],
} as const satisfies Prisma.SurveySelect["embeddedDataLinks"];

/** The shape {@link selectSurveyEmbeddedDataLinks} produces, as much of it as the mapping needs. */
interface TSurveyWithEmbeddedDataLinks {
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
 * Ordering is not this function's job (ENG-2401): the rows carry an `order` column and arrive sorted
 * by it. Before that column existed this ranked them against the legacy JSON, which needed guards
 * here so that one malformed column could not take down an entire survey read.
 */
export const inlineSurveyEmbeddedFields = (
  surveyPrisma: TSurveyWithEmbeddedDataLinks
): TLinkedEmbeddedField[] | undefined => {
  const links = surveyPrisma.embeddedDataLinks;
  if (!links) return undefined;

  return links.map((link) => ({ field: link.embeddedData, link: { storageKey: link.storageKey } }));
};

/**
 * Replaces the raw `embeddedDataLinks` relation on a Prisma survey row with the inlined
 * `embeddedFields` the read seam consumes, so the relation shape never leaks onto `TSurvey`.
 * A no-op for rows read through a select without the join.
 */
export const withInlinedEmbeddedFields = <T extends TSurveyWithEmbeddedDataLinks>(
  surveyPrisma: T
): Omit<T, "embeddedDataLinks"> & { embeddedFields?: TLinkedEmbeddedField[] } => {
  const { embeddedDataLinks: _links, ...rest } = surveyPrisma;
  const embeddedFields = inlineSurveyEmbeddedFields(surveyPrisma);
  return embeddedFields ? { ...rest, embeddedFields } : rest;
};
