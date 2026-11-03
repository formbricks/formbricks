import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import {
  EMBEDDED_DATA_DEFAULT_VALUE_MAX_LENGTH,
  EMBEDDED_DATA_KEY_MAX_LENGTH,
  EMBEDDED_DATA_NAME_MAX_LENGTH,
  NULL_BYTE_MESSAGE,
  type TEmbeddedDataDefaultValue,
  type TEmbeddedDataType,
  ZEmbeddedDataDefaultValue,
  ZEmbeddedDataType,
  getEmbeddedFieldDefinitionIssues,
  hasNoNullByte,
} from "@formbricks/types/embedded-data";
import { type TDesiredEmbeddedField, toLegacyEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { isLegacyIdCharset } from "@formbricks/types/safe-identifier";
import {
  type TSurveyHiddenFields,
  type TSurveyVariable,
  ZStoredSurveyVariables,
  ZSurveyHiddenFields,
} from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";

/**
 * Typed Embedded Data on the v3 survey document (ENG-6930, ADR 0027).
 *
 * `embeddedFields` sits next to the legacy `variables` / `hiddenFields`, which stay a projection of
 * it. One entry is one field the survey has, flat: the survey's address for it (`storageKey`), the
 * library `key` when it links a workspace library field, and its definition. Logic operands do not
 * change: a `variable` operand names a computed field's storage key, a `hiddenField` operand an
 * ingested field's.
 */

/** The unknown-key allowlist for one entry. */
export const V3_EMBEDDED_FIELD_KEYS = new Set([
  "storageKey",
  "key",
  "name",
  "source",
  "dataType",
  "defaultValue",
  "locked",
]);

/** A field as GET returns it, and as a write ends up once every default is filled in. */
export type TV3SurveyEmbeddedField = {
  storageKey: string;
  key: string | null;
  name: string;
  source: "computed" | "ingested";
  dataType: TEmbeddedDataType;
  defaultValue: TEmbeddedDataDefaultValue;
  locked: boolean;
};

const isBlank = (value: string) => value.trim().length === 0;

/**
 * One entry as a write may send it.
 *
 * A **local** field (`key` null or omitted) declares itself: `name` and `source` are required, and
 * the rest default. A **library** field is linked by its `key` alone: the server fills in the
 * definition from the workspace library before anything is validated
 * (`resolveV3EmbeddedFieldLibraryKeys`), so its definition keys may be omitted, and are replaced by the
 * library's when sent. `storageKey` is optional everywhere: a computed field gets a fresh cuid2, an
 * ingested one its name (a local field) or its key (a library field).
 *
 * `dataType` takes the whole enum, but a computed field accepts only what the logic engine computes
 * (`COMPUTED_EMBEDDED_DATA_TYPES`: text, number and, since ENG-6935, date).
 */
export const ZV3SurveyEmbeddedField = z
  .object({
    storageKey: z
      .string()
      .refine((value) => !isBlank(value), "Storage key must not be blank")
      .refine(isLegacyIdCharset, "Storage key must contain only letters, digits, hyphens and underscores")
      .optional()
      .describe(
        "The survey's address for the field: logic operands name it. Optional; defaults to a new cuid2 (computed) or the name / library key (ingested)."
      ),
    key: z
      .string()
      .min(1)
      .max(EMBEDDED_DATA_KEY_MAX_LENGTH)
      .refine(hasNoNullByte, `Key ${NULL_BYTE_MESSAGE}`)
      .nullable()
      .optional()
      .describe(
        "A workspace library key, to link that library field; its definition is filled in from the library. null or omitted declares a local field."
      ),
    name: z
      .string()
      .max(EMBEDDED_DATA_NAME_MAX_LENGTH)
      .refine((value) => !isBlank(value), "Name must not be blank")
      .refine(hasNoNullByte, `Name ${NULL_BYTE_MESSAGE}`)
      .optional()
      .describe("Display name. Required for a local field; for an ingested one also the URL parameter."),
    source: z
      .enum(["computed", "ingested"])
      .optional()
      .describe(
        "computed: set by logic (Set value). ingested: read from the URL or the SDK. Required for a local field."
      ),
    dataType: ZEmbeddedDataType.optional().describe(
      "string (default), number, boolean or date. A computed field is string, number or date."
    ),
    defaultValue: ZEmbeddedDataDefaultValue.refine(
      (value) =>
        typeof value !== "string" ||
        (value.length <= EMBEDDED_DATA_DEFAULT_VALUE_MAX_LENGTH && hasNoNullByte(value)),
      `A text default value may be at most ${String(EMBEDDED_DATA_DEFAULT_VALUE_MAX_LENGTH)} characters and ${NULL_BYTE_MESSAGE}`
    )
      .optional()
      .describe(
        "Initial value (computed) or fallback when nothing arrives (ingested), matching dataType; a date is ISO 8601. Defaults to null."
      ),
    locked: z
      .boolean()
      .optional()
      .describe(
        "Ingested fields only: true ignores what the URL or SDK sends and always uses defaultValue. Defaults to false."
      ),
  })
  .strict()
  .superRefine((entry, ctx) => {
    // A library entry's definition is the library's, checked when it is filled in.
    if (typeof entry.key === "string") return;

    for (const field of ["name", "source"] as const) {
      if (entry[field] === undefined) {
        ctx.addIssue({
          code: "custom",
          message: `Missing required field '${field}' for a field that links no library key`,
          path: [field],
          params: { code: "missing_required_field" },
        });
      }
    }
    if (entry.source === undefined) return;

    for (const issue of getEmbeddedFieldDefinitionIssues({
      source: entry.source,
      dataType: entry.dataType ?? "string",
      defaultValue: entry.defaultValue ?? null,
      locked: entry.locked ?? false,
    })) {
      ctx.addIssue({ code: "custom", message: issue.message, path: [issue.path] });
    }
  });

export type TV3SurveyEmbeddedFieldInput = z.infer<typeof ZV3SurveyEmbeddedField>;

/**
 * Refused when the request's Embedded Data cannot be taken as sent: the two formats disagree, a
 * library key does not exist, or a field could never be stored. A client error the body alone
 * explains, so the routes answer it 400 with `invalid_params` naming each path.
 */
export class V3SurveyEmbeddedFieldsError extends Error {
  constructor(readonly invalidParams: InvalidParam[]) {
    super("Survey Embedded Data fields are invalid");
    this.name = "V3SurveyEmbeddedFieldsError";
  }
}

const toDesired = (entry: TV3SurveyEmbeddedField): TDesiredEmbeddedField => ({
  storageKey: entry.storageKey,
  name: entry.name,
  source: entry.source,
  dataType: entry.dataType,
  defaultValue: entry.defaultValue,
  locked: entry.locked,
  key: entry.key,
});

/** GET's `embeddedFields`: the survey's rows, flattened. */
export function toV3SurveyEmbeddedFields(fields: readonly TLinkedEmbeddedField[]): TV3SurveyEmbeddedField[] {
  return fields
    .filter(
      (entry): entry is TLinkedEmbeddedField & { field: { source: "computed" | "ingested" } } =>
        entry.field.source !== "reserved"
    )
    .map(({ field, link }) => ({
      storageKey: link.storageKey,
      key: field.key,
      name: field.name,
      source: field.source,
      dataType: field.dataType,
      defaultValue: field.defaultValue,
      locked: field.locked,
    }));
}

/**
 * The `{ field, link }` pairs the survey service and the reconcile take. A library entry names the
 * row it links by id, which `libraryFieldIdsByKey` supplies; a key it lacks is a library field that
 * disappeared since the request was resolved, refused rather than turned into a local copy.
 */
export function toLinkedEmbeddedFields(
  entries: readonly TV3SurveyEmbeddedField[],
  libraryFieldIdsByKey: ReadonlyMap<string, string>
): { ok: true; fields: TLinkedEmbeddedField[] } | { ok: false; invalidParams: InvalidParam[] } {
  const invalidParams: InvalidParam[] = [];
  const fields = entries.map((entry, index): TLinkedEmbeddedField => {
    const { storageKey, key, ...definition } = entry;
    const id = key === null ? undefined : libraryFieldIdsByKey.get(key);
    if (key !== null && id === undefined) {
      invalidParams.push(unknownLibraryKeyIssue(index, key));
    }
    return { field: { ...definition, key, ...(id ? { id } : {}) }, link: { storageKey } };
  });

  return invalidParams.length > 0 ? { ok: false, invalidParams } : { ok: true, fields };
}

export function unknownLibraryKeyIssue(index: number, key: string): InvalidParam {
  return {
    name: `embeddedFields.${index}.key`,
    reason: `No Embedded Data field with key '${key}' in this workspace's library`,
    code: "invalid_reference",
    identifier: key,
  };
}

/** Which legacy keys the request itself carried, as opposed to defaults or the stored survey's. */
export type TV3LegacyEmbeddedFieldsSent = { variables: boolean; hiddenFields: boolean };

type TV3EmbeddedFieldFormatsResult =
  | {
      ok: true;
      embeddedFields: TV3SurveyEmbeddedField[];
      variables: TSurveyVariable[];
      hiddenFields: TSurveyHiddenFields;
    }
  | { ok: false; invalidParams: InvalidParam[] };

/** Every entry complete, with its storage key decided. */
function completeEntries(entries: readonly TV3SurveyEmbeddedFieldInput[]): {
  entries: TV3SurveyEmbeddedField[];
  invalidParams: InvalidParam[];
} {
  const invalidParams: InvalidParam[] = [];
  const complete: TV3SurveyEmbeddedField[] = [];

  entries.forEach((entry, index) => {
    const key = entry.key ?? null;
    if (entry.name === undefined || entry.source === undefined) {
      // Only reachable for a library entry nobody resolved: every write path resolves first.
      invalidParams.push(unknownLibraryKeyIssue(index, key ?? ""));
      return;
    }

    complete.push({
      storageKey: entry.storageKey ?? (entry.source === "computed" ? createId() : (key ?? entry.name)),
      key,
      name: entry.name,
      source: entry.source,
      dataType: entry.dataType ?? "string",
      defaultValue: entry.defaultValue ?? null,
      locked: entry.locked ?? false,
    });
  });

  return { entries: complete, invalidParams };
}

function duplicateStorageKeyIssues(entries: readonly TV3SurveyEmbeddedField[]): InvalidParam[] {
  const seen = new Set<string>();
  const invalidParams: InvalidParam[] = [];
  entries.forEach((entry, index) => {
    if (seen.has(entry.storageKey)) {
      invalidParams.push({
        name: `embeddedFields.${index}.storageKey`,
        reason: `Storage key '${entry.storageKey}' is used by another field`,
        code: "duplicate_identifier",
        identifier: entry.storageKey,
      });
    }
    seen.add(entry.storageKey);
  });
  return invalidParams;
}

/** The index in `entries` of the field a legacy entry was derived from. */
function entryIndex(entries: readonly TV3SurveyEmbeddedField[], source: string, storageKey: string): number {
  return entries.findIndex((entry) => entry.source === source && entry.storageKey === storageKey);
}

/**
 * The legacy projection has to parse as a stored survey's `variables` / `hiddenFields`, or the survey
 * written now would fail its next read. A computed field's storage key is a variable id (a cuid2) and
 * its name a variable name; an ingested field's storage key is a hidden field id.
 */
function storabilityIssues(
  entries: readonly TV3SurveyEmbeddedField[],
  derived: { variables: TSurveyVariable[]; hiddenFields: TSurveyHiddenFields }
): InvalidParam[] {
  const invalidParams: InvalidParam[] = [];
  const pathOf = (source: string, storageKey: string | undefined) => {
    const index = storageKey === undefined ? -1 : entryIndex(entries, source, storageKey);
    return index === -1 ? "embeddedFields" : `embeddedFields.${index}`;
  };

  const variables = ZStoredSurveyVariables.safeParse(derived.variables);
  if (!variables.success) {
    for (const issue of variables.error.issues) {
      const position = issue.path[0];
      const variable = typeof position === "number" ? derived.variables[position] : undefined;
      invalidParams.push({ name: pathOf("computed", variable?.id), reason: issue.message });
    }
  }

  const hiddenFields = ZSurveyHiddenFields.safeParse(derived.hiddenFields);
  if (!hiddenFields.success) {
    for (const issue of hiddenFields.error.issues) {
      const position = issue.path[1];
      const fieldId = typeof position === "number" ? derived.hiddenFields.fieldIds?.[position] : undefined;
      invalidParams.push({ name: pathOf("ingested", fieldId), reason: issue.message });
    }
  }

  return invalidParams;
}

const VARIABLE_PROPERTIES = ["name", "type", "value"] as const;

/**
 * Where the legacy format the request sent disagrees with the one `embeddedFields` derives into.
 *
 * Compared as sets, matched by address: a variable by its id (a computed field's storage key), a
 * hidden field by its id (an ingested field's storage key). Order and `hiddenFields.enabled` are not
 * compared — both are derived. A legacy entry with no field is reported at its own path, a field the
 * legacy format leaves out at its `embeddedFields` entry.
 */
function disagreementIssues(
  entries: readonly TV3SurveyEmbeddedField[],
  derived: { variables: TSurveyVariable[]; hiddenFields: TSurveyHiddenFields },
  sent: { variables?: readonly TSurveyVariable[]; hiddenFields?: TSurveyHiddenFields }
): InvalidParam[] {
  const invalidParams: InvalidParam[] = [];
  const mismatch = (name: string, reason: string, identifier: string): InvalidParam => ({
    name,
    reason: `${reason}. Send embeddedFields alone, or legacy fields that describe the same fields.`,
    code: "invalid_reference",
    identifier,
  });

  if (sent.variables) {
    const derivedById = new Map(derived.variables.map((variable) => [variable.id, variable]));
    const sentIds = new Set(sent.variables.map((variable) => variable.id));

    sent.variables.forEach((variable, index) => {
      const expected = derivedById.get(variable.id);
      if (!expected) {
        invalidParams.push(
          mismatch(
            `variables.${index}`,
            `Variable '${variable.id}' has no computed field with that storageKey in embeddedFields`,
            variable.id
          )
        );
        return;
      }
      for (const property of VARIABLE_PROPERTIES) {
        if (variable[property] !== expected[property]) {
          invalidParams.push(
            mismatch(
              `variables.${index}.${property}`,
              `Variable '${variable.id}' has ${property} '${String(variable[property])}', but embeddedFields derives '${String(expected[property])}'`,
              variable.id
            )
          );
        }
      }
    });

    for (const variable of derived.variables) {
      if (!sentIds.has(variable.id)) {
        invalidParams.push(
          mismatch(
            `embeddedFields.${entryIndex(entries, "computed", variable.id)}`,
            `Computed field '${variable.id}' is missing from variables`,
            variable.id
          )
        );
      }
    }
  }

  if (sent.hiddenFields) {
    const derivedIds = new Set(derived.hiddenFields.fieldIds ?? []);
    const sentIds = sent.hiddenFields.fieldIds ?? [];

    sentIds.forEach((fieldId, index) => {
      if (!derivedIds.has(fieldId)) {
        invalidParams.push(
          mismatch(
            `hiddenFields.fieldIds.${index}`,
            `Hidden field '${fieldId}' has no ingested field with that storageKey in embeddedFields`,
            fieldId
          )
        );
      }
    });

    const sentIdSet = new Set(sentIds);
    for (const fieldId of derived.hiddenFields.fieldIds ?? []) {
      if (!sentIdSet.has(fieldId)) {
        invalidParams.push(
          mismatch(
            `embeddedFields.${entryIndex(entries, "ingested", fieldId)}`,
            `Ingested field '${fieldId}' is missing from hiddenFields.fieldIds`,
            fieldId
          )
        );
      }
    }
  }

  return invalidParams;
}

/**
 * Settles the two Embedded Data formats of one write (ADR 0027).
 *
 * Takes the request's `embeddedFields` (library entries already filled in) and whichever legacy keys
 * the request itself sent, and answers with the complete fields plus the legacy projection derived
 * from them — so the rest of the write path, reference validation included, reads the fields the
 * survey will actually have. Sent together, the two formats have to describe the same fields, or the
 * write is refused naming each path where they part: a client that edits one format while echoing
 * the other back would otherwise lose its edit without noticing.
 */
export function settleV3EmbeddedFieldFormats(
  embeddedFields: readonly TV3SurveyEmbeddedFieldInput[],
  sent: { variables?: readonly TSurveyVariable[]; hiddenFields?: TSurveyHiddenFields }
): TV3EmbeddedFieldFormatsResult {
  const completed = completeEntries(embeddedFields);
  const invalidParams = [...completed.invalidParams, ...duplicateStorageKeyIssues(completed.entries)];
  if (invalidParams.length > 0) {
    return { ok: false, invalidParams };
  }

  const entries = completed.entries;
  const derived = toLegacyEmbeddedFields(entries.map(toDesired));
  invalidParams.push(...storabilityIssues(entries, derived), ...disagreementIssues(entries, derived, sent));
  if (invalidParams.length > 0) {
    return { ok: false, invalidParams };
  }

  return {
    ok: true,
    embeddedFields: entries,
    variables: derived.variables,
    hiddenFields: derived.hiddenFields,
  };
}
