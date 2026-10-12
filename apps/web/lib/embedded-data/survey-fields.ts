import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import {
  type TLegacyEmbeddedColumns,
  linkedToDesiredEmbeddedFields,
  toLegacyEmbeddedFields,
} from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";

/**
 * The join that makes the `EmbeddedData` / `SurveyEmbeddedData` tables the read source of truth
 * (ENG-1837). Add it to a survey select and pass the row through {@link withInlinedEmbeddedFields};
 * every reader then resolves definitions through `getSurveyEmbeddedFields`, and the legacy
 * `variables` / `hiddenFields` keys outbound payloads still carry are derived from the same rows.
 *
 * Only the columns a reader or the editor's write-back needs are selected — the row's owning
 * survey, workspace and timestamps stay server-side. It mirrors `SELECT_CURRENT_FIELDS` in
 * reconcile.ts minus exactly those.
 *
 * **This selector is for authenticated readers.** It carries the library row `id`, so every
 * respondent-facing loader takes {@link selectPublicSurveyEmbeddedDataLinks} below instead: the
 * link-survey page, the v1 client environment, and the contact-link page.
 *
 * `id` and `key` are here because the pairs are a **write** shape as well as a read one (ENG-3228):
 * a shared entry is sent back by the id of the library row it links, and `key !== null` is what says
 * it is shared at all. Drop either and the editor can load a shared link but never save one. A local
 * row carries `key: null`, which is the same thing the row itself stores.
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
      select: {
        id: true,
        key: true,
        name: true,
        source: true,
        dataType: true,
        defaultValue: true,
        locked: true,
      },
    },
  },
  orderBy: [{ order: "asc" }, { storageKey: "asc" }],
} as const satisfies Prisma.SurveySelect["embeddedDataLinks"];

/**
 * The same relation without the workspace-library row id, for payloads an anonymous respondent
 * receives.
 *
 * The renderer resolves recall and logic through `storageKey`, `key`, `dataType` and the default;
 * `field.id` is read only by the write path (`linkedToDesiredEmbeddedFields` turns it into
 * `embeddedDataId`) and by the reconcile, which reads the survey's own links inside its
 * transaction. Nothing public needs it, so nothing public ships it — `TLinkedEmbeddedField.field`
 * already declares `id` optional, so this is the same type with one field fewer.
 */
export const selectPublicSurveyEmbeddedDataLinks = {
  ...selectSurveyEmbeddedDataLinks,
  select: {
    ...selectSurveyEmbeddedDataLinks.select,
    embeddedData: {
      select: {
        key: true,
        name: true,
        source: true,
        dataType: true,
        defaultValue: true,
        locked: true,
      },
    },
  },
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
 * when the select omitted the join.
 *
 * Zero rows is zero fields (ENG-2404). The legacy columns this used to fall back to for a survey the
 * ENG-1835 backfill skipped are gone; the migration that dropped them gave every such survey its
 * rows first.
 *
 * Ordering is not this function's job (ENG-2401): the rows carry an `order` column and arrive sorted
 * by it.
 */
export const inlineSurveyEmbeddedFields = (
  surveyPrisma: TSurveyWithEmbeddedDataLinks
): TLinkedEmbeddedField[] | undefined =>
  surveyPrisma.embeddedDataLinks?.map((link) => ({
    field: link.embeddedData,
    link: { storageKey: link.storageKey },
  }));

/**
 * What {@link withInlinedEmbeddedFields} returns: a select that carried the join always yields the
 * inlined pairs and the two derived legacy keys; one that may not have, may not.
 */
type TInlinedSurvey<T extends TSurveyWithEmbeddedDataLinks> = Omit<T, "embeddedDataLinks"> &
  (T extends { embeddedDataLinks: unknown[] }
    ? { embeddedFields: TLinkedEmbeddedField[] } & TLegacyEmbeddedColumns
    : { embeddedFields?: TLinkedEmbeddedField[] } & Partial<TLegacyEmbeddedColumns>);

/**
 * Replaces the raw `embeddedDataLinks` relation on a Prisma survey row with the inlined
 * `embeddedFields` the read seam consumes, so the relation shape never leaks onto `TSurvey` — and
 * derives the legacy `variables` / `hiddenFields` from the same rows.
 *
 * The two legacy keys are a **read-only projection** now (ENG-2404): `Survey` has no column for
 * either, but deployed SDK bundles and v1 / v3 API consumers still read them (ENG-1838), and the
 * `ZSurvey` logic refinement resolves operands against them. Deriving them here, from the rows and
 * in row order, is what keeps every one of those payloads saying exactly what the rows say.
 *
 * A no-op for rows read through a select without the join: such a survey carries neither
 * `embeddedFields` nor the two legacy keys.
 */
export const withInlinedEmbeddedFields = <T extends TSurveyWithEmbeddedDataLinks>(
  surveyPrisma: T
): TInlinedSurvey<T> => {
  const { embeddedDataLinks: _links, ...rest } = surveyPrisma;
  const embeddedFields = inlineSurveyEmbeddedFields(surveyPrisma);
  if (!embeddedFields) return rest as TInlinedSurvey<T>;
  return {
    ...rest,
    embeddedFields,
    ...toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(embeddedFields)),
  } as TInlinedSurvey<T>;
};
