import {
  type TEmbeddedDataDefaultValue,
  type TEmbeddedDataSource,
  type TEmbeddedDataType,
} from "./embedded-data";
// Type-only, and it has to stay that way: `embedded-data-resolver.ts` imports this module for
// `toDesiredEmbeddedFields`, so a value import here would close a runtime cycle between the two.
import type { TLinkedEmbeddedField } from "./embedded-data-resolver";
import { type TSurveyHiddenFields, type TSurveyVariable } from "./surveys/types";

/**
 * One Embedded Data field a survey should have, derived from its legacy shape.
 *
 * This is the row-plus-link pair flattened into one object: everything except the ids the database
 * assigns. `storageKey` is the address the field is already reachable at, so it is what both sides
 * of a reconcile compare on.
 *
 * `key` and `embeddedDataId` are how an entry says who owns it, and they move together (ENG-3228):
 * a **local** entry is `key: null` with no `embeddedDataId` and the survey owns its definition; a
 * **shared** entry carries the library key and the id of the workspace-owned row it links. Ownership
 * is never a flag on the wire — it is read off `key`, exactly as {@link isLocalEmbeddedData} reads it
 * off a stored row.
 */
export interface TDesiredEmbeddedField {
  /** The address this field's value lives under inside the survey. */
  storageKey: string;
  name: string;
  source: TEmbeddedDataSource;
  dataType: TEmbeddedDataType;
  defaultValue: TEmbeddedDataDefaultValue;
  locked: boolean;
  /** The library key when this entry links a shared definition, null when the survey owns it. */
  key: string | null;
  /** The shared row this entry links. Set exactly when `key` is non-null. */
  embeddedDataId?: string;
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
 * Every field it produces is **local** (`key: null`) and unlocked: the legacy columns have no
 * carrier for a library link or a lock, so neither can arrive this way. What they also cannot carry
 * is preserved rather than reset — see `resolveDesiredEmbeddedFields` in
 * apps/web/lib/embedded-data/reconcile.ts, which merges this output over the survey's current rows.
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
    locked: false,
    key: null,
  }));

  const ingested: TDesiredEmbeddedField[] = (hiddenFields?.fieldIds ?? []).map((fieldId) => ({
    // A hidden field is addressed by its name, and has no display label separate from it.
    storageKey: fieldId,
    name: fieldId,
    source: "ingested",
    // Hidden fields were untyped strings, and had no default. Typing them is a v2 action.
    dataType: "string",
    defaultValue: null,
    locked: false,
    key: null,
  }));

  return [...computed, ...ingested];
};

/**
 * Translates the `embeddedFields` a write payload carries into the fields the survey should have.
 *
 * The V2 authoring path's counterpart to {@link toDesiredEmbeddedFields} (ENG-3228). Where the
 * legacy columns can only say "a variable named x" or "a hidden field named y", this carries
 * everything a row holds — `dataType`, `defaultValue`, `locked` — plus the library link, so the
 * panel can type a field, give it a default, lock it, or point it at the workspace library.
 *
 * `embeddedFields` is the same shape on the way in as on the way out: the pairs a survey is loaded
 * with are exactly the pairs it can be saved with, which is what lets the editor send a shared link
 * straight back. Ownership is derived per entry rather than declared — `field.key !== null` means
 * the entry links the shared row `field.id`, and the definition attributes beside it describe that
 * row rather than asking to change it.
 */
export const linkedToDesiredEmbeddedFields = (
  embeddedFields: readonly TLinkedEmbeddedField[]
): TDesiredEmbeddedField[] =>
  embeddedFields.map(({ field, link }) => ({
    storageKey: link.storageKey,
    name: field.name,
    source: field.source,
    dataType: field.dataType,
    defaultValue: field.defaultValue,
    locked: field.locked,
    key: field.key,
    // Only meaningful for a shared entry; a local one is created rather than linked, so the id of a
    // row it does not own would be a lie waiting to be dereferenced.
    ...(field.key !== null && field.id !== undefined ? { embeddedDataId: field.id } : {}),
  }));

/** The legacy columns a survey's fields derive back into — both written on every save. */
export interface TLegacyEmbeddedColumns {
  variables: TSurveyVariable[];
  hiddenFields: TSurveyHiddenFields;
}

/**
 * The legacy name a computed field answers to.
 *
 * A **shared** computed field uses its library key rather than its display name, because
 * `ZSurveyVariable` runs every name through `isLegacyVariableName` — a library field labelled
 * `Plan tier` would fail the schema the derived column is validated by on every save and read. The
 * key is the one spelling of a shared field that is guaranteed to be an identifier, and it is also
 * the name the library itself addresses the field by.
 */
const legacyComputedName = (field: TDesiredEmbeddedField): string => field.key ?? field.name;

/**
 * One computed field as the legacy `variables` entry it is stored as.
 *
 * The value is guarded rather than copied: `ZSurveyVariable` is a discriminated union whose `number`
 * arm demands a number and whose `text` arm demands a string, while `defaultValue` is a `string |
 * number | boolean | null` that a `boolean` or `date` field could legitimately hold. Anything that
 * cannot be the variable's declared type falls back to the same value the schema's `prefault` would
 * have supplied, so the derived column always parses.
 */
const toLegacyVariable = (field: TDesiredEmbeddedField): TSurveyVariable =>
  field.dataType === "number"
    ? {
        id: field.storageKey,
        name: legacyComputedName(field),
        type: "number",
        value: typeof field.defaultValue === "number" ? field.defaultValue : 0,
      }
    : {
        id: field.storageKey,
        name: legacyComputedName(field),
        type: "text",
        value: typeof field.defaultValue === "string" ? field.defaultValue : "",
      };

/**
 * Derives the legacy `variables` / `hiddenFields` columns back out of a survey's fields — the
 * inverse of {@link toDesiredEmbeddedFields}, and what keeps the dual write honest once a payload
 * declares its fields as rows instead of columns (ENG-3228).
 *
 * The columns are no longer an input on that path, but they are still written: they are the rollback
 * net until ENG-2404 drops them, and deployed SDK bundles read them off the workspace-state payload.
 * Deriving them rather than trusting whatever `variables` the same payload happened to carry is what
 * stops the two descriptions of one survey drifting apart.
 *
 * `hiddenFields.enabled` is carried over from the survey's current value and only ever turned **on**:
 * the flag is a survey-level toggle rather than a property of any field, and the two ingest paths
 * disagree about it (js-core honours it, the link-survey URL path ignores it), so turning it off
 * behind the author's back would silently stop the SDK filling fields they can still see. A survey
 * that gains its first ingested field gets the flag set — which is what the hidden-fields card did
 * itself until ENG-2628 moved the legacy columns entirely onto this derivation.
 */
export const toLegacyEmbeddedFields = (
  desired: readonly TDesiredEmbeddedField[],
  previousHiddenFields?: TSurveyHiddenFields | null
): TLegacyEmbeddedColumns => {
  const variables = desired.filter((field) => field.source === "computed").map(toLegacyVariable);
  const fieldIds = desired.filter((field) => field.source === "ingested").map((field) => field.storageKey);

  return {
    variables,
    hiddenFields: {
      enabled: (previousHiddenFields?.enabled ?? false) || fieldIds.length > 0,
      fieldIds,
    },
  };
};
