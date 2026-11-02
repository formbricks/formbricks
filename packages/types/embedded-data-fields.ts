import type { TLinkedEmbeddedField } from "./embedded-data-resolver";

// The definition getters live apart from `embedded-data-resolver` so that a browser bundle needing only
// these — the link survey reading its ingested storage keys — does not also load the resolver's
// runtime imports, `surveys/validation` and its HTML parser among them. The resolver re-exports them,
// so every existing import keeps working.

/**
 * The survey slice {@link getSurveyEmbeddedFields} needs. Deliberately looser than `TSurvey`: the
 * readers this serves hold everything from a full survey to a four-key `Pick`, and every one of them
 * must be able to call the accessor without widening its own select.
 */
export interface TEmbeddedFieldsSurvey {
  /** The rows, joined and inlined at load. Absent when the select omitted the join. */
  embeddedFields?: TLinkedEmbeddedField[] | null;
}

/**
 * **Where a survey's Embedded Data definitions come from.** Every reader — recall, logic, export
 * columns, response filters, response tables, emails, integrations, the editor's own cards and
 * pickers, and the preview — calls this and nothing else.
 *
 * **The rows are the whole answer** (ENG-2412, ENG-2404). A survey with no rows is a survey with no
 * fields. The legacy `variables` / `hiddenFields` a survey still carries are derived *from* these
 * rows at the read seam, so there is nothing else to consult; a survey that has never been written
 * (a template in the gallery) is given `embeddedFields` where it is built, by
 * `embeddedFieldsFromLegacyInput`.
 *
 * **Every survey select that reaches a reader must therefore carry the join** —
 * `selectSurveyEmbeddedDataLinks`, inlined by `transformPrismaSurvey`. A select that omits it yields
 * `undefined` here and the survey reads as having no fields at all.
 *
 * This is a *definition* lookup only. ENG-1837 repoints where a field's name, source and dataType
 * come from; it deliberately does not repoint value arithmetic onto {@link resolveEmbeddedValue},
 * whose coercion and default tiers differ from today's call-site expressions (see the swap checklist
 * on {@link resolveEmbeddedValue}) and would change what stored responses render as.
 */
export const getSurveyEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  survey.embeddedFields ?? [];

/** The computed (ex-variable) fields of a survey, in inlined order. */
export const getComputedEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  getSurveyEmbeddedFields(survey).filter(({ field }) => field.source === "computed");

/** The ingested (ex-hidden-field) fields of a survey, in inlined order. */
export const getIngestedEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  getSurveyEmbeddedFields(survey).filter(({ field }) => field.source === "ingested");

/** The storage keys of a survey's ingested fields — what `response.data` addresses them by. */
export const getIngestedStorageKeys = (survey: TEmbeddedFieldsSurvey): string[] =>
  getIngestedEmbeddedFields(survey).map(({ link }) => link.storageKey);
