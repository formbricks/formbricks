import {
  type TEmbeddedDataDefaultValue,
  type TEmbeddedDataSource,
  type TEmbeddedDataType,
} from "./embedded-data";
import { type TSurveyHiddenFields, type TSurveyVariable } from "./surveys/types";

/**
 * One Embedded Data field a survey should have, derived from its legacy shape.
 *
 * This is the row-plus-link pair flattened into one object: everything except the ids the database
 * assigns. `storageKey` is the address the field is already reachable at, so it is what both sides
 * of a reconcile compare on.
 */
export interface TDesiredEmbeddedField {
  /** The address this field's value lives under inside the survey. */
  storageKey: string;
  name: string;
  source: TEmbeddedDataSource;
  dataType: TEmbeddedDataType;
  defaultValue: TEmbeddedDataDefaultValue;
}

/** A survey's legacy Embedded Data, the only two places it lives before the tables exist. */
export interface TLegacyEmbeddedFields {
  variables?: TSurveyVariable[] | null;
  hiddenFields?: TSurveyHiddenFields | null;
}

/**
 * Translates a survey's legacy `variables` + `hiddenFields` into the fields it should have as rows.
 *
 * Shared by the two things that write those rows: the editor write bridge (ENG-1978) and the
 * one-time backfill (ENG-1835). Keeping it in `@formbricks/types` is what lets both reach it — a
 * data migration in `packages/database` cannot import from `apps/web`.
 *
 * **The rule that makes the migration safe:** `storageKey` is the field's *existing* address — a
 * variable's cuid, a hidden field's name — never a new or normalised one. Those are the keys recall
 * tokens, logic operands and stored responses already use, so preserving them is what lets every
 * survey keep resolving untouched. Legacy names with uppercase letters or hyphens pass through
 * exactly as stored.
 *
 * Faithful, not defensive: duplicate `storageKey`s in the input come back as duplicate entries
 * rather than being silently merged, so each caller can choose whether that is an error to report
 * or a broken survey to skip.
 */
export const toDesiredEmbeddedFields = ({
  variables,
  hiddenFields,
}: TLegacyEmbeddedFields): TDesiredEmbeddedField[] => {
  const computed: TDesiredEmbeddedField[] = (variables ?? []).map((variable) => ({
    // A variable is addressed by its cuid everywhere, so that is the storage key.
    storageKey: variable.id,
    name: variable.name,
    source: "computed",
    dataType: variable.type === "number" ? "number" : "string",
    defaultValue: variable.value,
  }));

  const ingested: TDesiredEmbeddedField[] = (hiddenFields?.fieldIds ?? []).map((fieldId) => ({
    // A hidden field is addressed by its name, and has no display label separate from it.
    storageKey: fieldId,
    name: fieldId,
    source: "ingested",
    // Hidden fields were untyped strings, and had no default. Typing them is a v2 action.
    dataType: "string",
    defaultValue: null,
  }));

  return [...computed, ...ingested];
};
