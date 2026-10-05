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

/**
 * A survey's Embedded Data in the legacy shape, as a write payload may still carry it (v1, v3, MCP,
 * templates). Input only since ENG-2404 dropped the columns it was once stored in.
 */
export interface TLegacyEmbeddedFields {
  variables?: TSurveyVariable[] | null;
  hiddenFields?: TSurveyHiddenFields | null;
}

/**
 * Translates a survey's legacy `variables` + `hiddenFields` into the fields it should have as rows.
 *
 * Shared by the things that write those rows from the legacy shape: the reconcile's legacy-input
 * branch, for a payload that still sends `variables` / `hiddenFields`, and the two backfills
 * (ENG-1835, and ENG-2404's before the columns were dropped). Keeping it in `@formbricks/types` is
 * what lets all of them reach it — a data migration in `packages/database` cannot import from
 * `apps/web`.
 *
 * **The rule that makes the migration safe:** `storageKey` is the field's *existing* address — a
 * variable's cuid, a hidden field's name — never a new or normalised one. Those are the keys recall
 * tokens, logic operands and stored responses already use, so preserving them is what lets every
 * survey keep resolving untouched. Legacy names with uppercase letters or hyphens pass through
 * exactly as stored.
 *
 * Every field it produces is **local** (`key: null`) and unlocked: the legacy shape has no
 * carrier for a library link or a lock, so neither can arrive this way. What it also cannot carry
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
 * **The input adapter** from the legacy shape to the `{ field, link }` pairs `embeddedFields`
 * carries — for a survey that has never been written and so has no rows to read.
 *
 * Not a read fallback: since ENG-2404 a stored survey has no legacy columns to fall back to, and
 * `getSurveyEmbeddedFields` reads its rows and nothing else. What still arrives in the legacy shape
 * is input — today the template presets, which the gallery previews before anything has reconciled
 * rows for them (`getTemplatePreviewSurvey`). The fields come out exactly as a write of the same
 * input would store them: the rules are {@link toDesiredEmbeddedFields}', local and unlocked, with
 * no row id because no row exists.
 */
export const embeddedFieldsFromLegacyInput = (legacy: TLegacyEmbeddedFields): TLinkedEmbeddedField[] =>
  toDesiredEmbeddedFields(legacy).map(({ storageKey, embeddedDataId: _embeddedDataId, ...field }) => ({
    field,
    link: { storageKey },
  }));

/**
 * Translates the `embeddedFields` a write payload carries into the fields the survey should have.
 *
 * The V2 authoring path's counterpart to {@link toDesiredEmbeddedFields} (ENG-3228). Where the
 * legacy shape can only say "a variable named x" or "a hidden field named y", this carries
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

/**
 * The legacy `variables` / `hiddenFields` shape a survey's fields derive back into. No longer stored
 * (ENG-2404): the read seam derives it from the rows for the payloads that still carry it.
 */
export interface TLegacyEmbeddedColumns {
  variables: TSurveyVariable[];
  hiddenFields: TSurveyHiddenFields;
}

/**
 * The legacy name a computed field answers to.
 *
 * A **shared** computed field uses its library key rather than its display name, because
 * `ZSurveyVariable` runs every name through `isLegacyVariableName` — a library field labelled
 * `Plan tier` would fail the schema the derived projection is validated by on every save. The
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
 * have supplied, so the derived projection always parses.
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
 * Derives the legacy `variables` / `hiddenFields` shape out of a survey's fields — the inverse of
 * {@link toDesiredEmbeddedFields}.
 *
 * Nothing stores the result any more (ENG-2404). It is the read-only projection deployed SDK bundles
 * and v1 / v3 API consumers still receive (ENG-1838), derived from the rows at every read, and what
 * the `ZSurvey` refinement resolves logic operands against for a payload that declares its fields as
 * `embeddedFields`. Both sides deriving it with this one function is what keeps them agreeing.
 *
 * `hiddenFields.enabled` has no storage of its own either, so it is derived too: on exactly when the
 * survey has an ingested field. The editor once had a toggle that switched it off (removed in #6649);
 * a value sent on write is ignored now, so a caller that relied on `enabled: false` removes the fields
 * instead.
 */
export const toLegacyEmbeddedFields = (desired: readonly TDesiredEmbeddedField[]): TLegacyEmbeddedColumns => {
  const variables = desired.filter((field) => field.source === "computed").map(toLegacyVariable);
  const fieldIds = desired.filter((field) => field.source === "ingested").map((field) => field.storageKey);

  return { variables, hiddenFields: { enabled: fieldIds.length > 0, fieldIds } };
};
