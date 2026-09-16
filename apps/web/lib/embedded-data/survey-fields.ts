import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { type TLegacyEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import {
  type TLinkedEmbeddedField,
  deriveLegacyEmbeddedData,
} from "@formbricks/types/embedded-data-resolver";

/**
 * The join that makes the `EmbeddedData` / `SurveyEmbeddedData` tables the read source of truth
 * (ENG-1837). Add it to a survey select and pass the row through {@link inlineSurveyEmbeddedFields};
 * every reader then resolves definitions through `getSurveyEmbeddedFields` instead of reading
 * `survey.variables` / `survey.hiddenFields`.
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

/**
 * The shape {@link selectSurveyEmbeddedDataLinks} produces, as much of it as the mapping needs.
 *
 * The legacy columns ride along because the mapping falls back to them for a row-less survey; both
 * members are optional, so a select that omits them is unaffected.
 */
interface TSurveyWithEmbeddedDataLinks extends TLegacyEmbeddedFields {
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

  // **A survey the backfill skipped has its declarations only in the legacy columns.** The migration
  // skips a survey whose `variables` or `hiddenFields` it cannot map — a malformed or duplicated
  // declaration — and records that such a survey "is not stranded ... it migrates itself the next
  // time someone saves it".
  //
  // An empty relation is truthy, so without this it inlined as `embeddedFields: []`, and every write
  // branch tests `!== undefined`. Any caller that loads a survey and hands it straight back to
  // `updateSurvey` — `updateSingleUseLinksAction` spreads one — then derives empty legacy columns
  // over the only copy of that survey's fields. Toggling single-use links would wipe them.
  //
  // So zero rows is not "no fields", it is "not reconciled yet", and the columns answer for it. One
  // row makes the rows authoritative again, and the first save through this path writes rows, so the
  // fallback heals itself and is never consulted twice for the same survey.
  if (links.length === 0) return deriveLegacyEmbeddedData(surveyPrisma);

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
