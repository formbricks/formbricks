import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import type { TSurveyHiddenFields, TSurveyVariables } from "@formbricks/types/surveys/types";
import type {
  TEmbeddedDataInsert,
  TLegacySurveyRow,
  TSurveyEmbeddedDataInsert,
} from "../20260812121944_backfill_embedded_data/utils";

export type { TEmbeddedDataInsert, TLegacySurveyRow, TSurveyEmbeddedDataInsert };

/**
 * What one survey's columns turn into, plus everything that could not come along.
 *
 * `lost` is empty for a survey whose columns mapped cleanly. Anything in it is a declaration this
 * migration read and could not keep — the columns are dropped right after it, so the list is the
 * only record that the declaration ever existed.
 */
export interface TSurveySalvagePlan {
  fields: TEmbeddedDataInsert[];
  links: TSurveyEmbeddedDataInsert[];
  lost: string[];
}

const describeShape = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
};

const isScalarDefault = (value: unknown): value is string | number | boolean | null =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/**
 * Keeps every variable that can become a row, one element at a time.
 *
 * The first backfill (ENG-1835) refused a survey outright when one element was bad, because the
 * columns stayed behind as the fallback and a later save would migrate it. There is no later now, so
 * a bad element costs only itself: it needs a non-empty string `id` (the storage key) and a string
 * `name` (a NOT NULL column). A value that is not a scalar is dropped to "no default" rather than
 * taking the variable with it.
 */
const salvageVariables = (value: unknown, lost: string[]): TSurveyVariables => {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    lost.push(`variables is ${describeShape(value)}, not an array`);
    return [];
  }

  const variables: TSurveyVariables = [];
  for (const [index, entry] of value.entries()) {
    const variable = salvageVariable(entry, index, lost);
    if (variable) variables.push(variable);
  }
  return variables;
};

/** One element of `variables`, or `null` when it cannot become a row (the reason goes to `lost`). */
const salvageVariable = (entry: unknown, index: number, lost: string[]): TSurveyVariables[number] | null => {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    lost.push(`variables[${index.toString()}] is ${describeShape(entry)}, not an object`);
    return null;
  }
  const { id, name, type, value: defaultValue } = entry as Record<string, unknown>;
  if (typeof id !== "string" || id === "") {
    lost.push(`variables[${index.toString()}] has no string id`);
    return null;
  }
  if (typeof name !== "string") {
    lost.push(`variable ${id} has no string name`);
    return null;
  }
  if (defaultValue !== undefined && !isScalarDefault(defaultValue)) {
    lost.push(`variable ${id} value is ${describeShape(defaultValue)}; stored without a default`);
  }
  // A claim about raw JSON rather than a parsed variable: `value` may not match `type` here, and
  // `toDesiredEmbeddedFields` copies it across as the default without looking.
  const variable = {
    id,
    name,
    type: type === "number" ? "number" : "text",
    value: isScalarDefault(defaultValue) ? defaultValue : null,
  };
  return variable as TSurveyVariables[number];
};

/** Keeps every hidden field id that is a non-empty string. */
const salvageHiddenFields = (value: unknown, lost: string[]): TSurveyHiddenFields => {
  if (value === null || value === undefined) return { enabled: false };
  if (typeof value !== "object" || Array.isArray(value)) {
    lost.push(`hiddenFields is ${describeShape(value)}, not an object`);
    return { enabled: false };
  }

  const fieldIds = (value as { fieldIds?: unknown }).fieldIds;
  if (fieldIds === null || fieldIds === undefined) return { enabled: false };
  if (!Array.isArray(fieldIds)) {
    lost.push(`hiddenFields.fieldIds is ${describeShape(fieldIds)}, not an array`);
    return { enabled: false };
  }

  const kept: string[] = [];
  for (const [index, fieldId] of fieldIds.entries()) {
    if (typeof fieldId !== "string" || fieldId === "") {
      lost.push(`hiddenFields.fieldIds[${index.toString()}] is not a non-empty string`);
      continue;
    }
    kept.push(fieldId);
  }
  return { enabled: kept.length > 0, fieldIds: kept };
};

/**
 * Works out the rows and links a survey with no links needs before its legacy columns are dropped
 * (ENG-2404), keeping as much as can be kept.
 *
 * The mapping is `toDesiredEmbeddedFields`, the same one the first backfill and the legacy write
 * path use, so a survey migrated here lands in the same order and at the same addresses as one
 * migrated there: variables in declaration order, then hidden fields, each at its existing address.
 *
 * What differs is what happens to a declaration that cannot become a row. The first backfill skipped
 * the whole survey and left it to the columns; this is the last read those columns get, so a bad
 * element is dropped on its own and a repeated storage key keeps its first occurrence — the one every
 * reader resolved while the columns were live, since recall and logic look a key up by first match.
 */
export const planSurveySalvage = (survey: TLegacySurveyRow, newId: () => string): TSurveySalvagePlan => {
  const lost: string[] = [];
  const variables = salvageVariables(survey.variables, lost);
  const hiddenFields = salvageHiddenFields(survey.hiddenFields, lost);

  const seen = new Set<string>();
  const fields: TEmbeddedDataInsert[] = [];
  const links: TSurveyEmbeddedDataInsert[] = [];

  for (const desiredField of toDesiredEmbeddedFields({ variables, hiddenFields })) {
    if (seen.has(desiredField.storageKey)) {
      lost.push(`duplicate ${desiredField.source} field ${desiredField.storageKey}; kept the first`);
      continue;
    }
    seen.add(desiredField.storageKey);

    if (desiredField.source === "reserved") {
      // Same guard as the first backfill: reserved fields are never rows, so this means the shared
      // mapping changed under us.
      throw new Error(
        `toDesiredEmbeddedFields produced a reserved field (${desiredField.storageKey}); reserved fields are never stored as rows`
      );
    }

    const embeddedDataId = newId();
    fields.push({
      id: embeddedDataId,
      workspaceId: survey.workspaceId,
      surveyId: survey.id,
      name: desiredField.name,
      source: desiredField.source,
      dataType: desiredField.dataType,
      defaultValue: desiredField.defaultValue ?? null,
    });
    links.push({
      id: newId(),
      workspaceId: survey.workspaceId,
      surveyId: survey.id,
      embeddedDataId,
      storageKey: desiredField.storageKey,
      // Position among the fields that were kept, so the stored order has no gaps.
      order: links.length,
    });
  }

  return { fields, links, lost };
};
