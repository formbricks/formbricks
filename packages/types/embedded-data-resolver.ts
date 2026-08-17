import { z } from "zod";
import type { TContactAttributeKey } from "./contact-attribute-key";
import type { TEmbeddedData, TEmbeddedDataType, TSurveyEmbeddedData } from "./embedded-data";
import { type TLegacyEmbeddedFields, toDesiredEmbeddedFields } from "./embedded-data-mapping";
import type { TI18nString } from "./i18n";
import type { TResponse, TResponseVariables } from "./responses";
import { formatSnakeCaseToTitleCase } from "./safe-identifier";
import type { TSurveyBlocks } from "./surveys/blocks";
import { getTextContent } from "./surveys/validation";

/**
 * What a resolved Embedded Data value can be. A `date` field resolves to its ISO 8601 string, not a
 * `Date` — machine-facing values stay ISO/UTC; display formatting is the consumer's job. One gap to
 * inherit consciously (ENG-1837/1839): today's recall formatters recognize date-ONLY strings
 * (`isValidDateString` in packages/surveys; `formatStoredDateForDisplay` in apps/web, which runs
 * only on the responseData branch), so a datetime resolved from a `Date` renders verbatim until the
 * consumers learn to format it. Booleans come from `boolean`-dataType stored fields (legal on
 * ingested rows) as well as reserved reads; {@link projectReservedValues} stringifies them for the
 * recall/logic maps, and direct resolver callers own their own boolean handling.
 */
export type TResolvedEmbeddedValue = string | number | boolean;

/**
 * The slice of a response the read seam consumes. A full `TResponse` is assignable, but resolvers
 * and reserved-catalog accessors are typed against this slice so they can never depend on fields
 * the seam doesn't own (contact, tags, display bookkeeping) — and so tests and future callers that
 * only hold partial data don't have to fabricate them.
 */
export type TEmbeddedValueResponse = Pick<
  TResponse,
  | "id"
  | "surveyId"
  | "createdAt"
  | "updatedAt"
  | "finished"
  | "language"
  | "data"
  | "variables"
  | "ttc"
  | "meta"
>;

/**
 * What a reserved-catalog accessor may return. Confined to scalars and `Date` on purpose: an entry
 * that could return `meta` or `data` wholesale would leak objects into the value maps, and the
 * compiler stops that here rather than a runtime check discovering it per response.
 */
export type TReservedFieldRawValue = string | number | boolean | Date | null | undefined;

/**
 * One reserved field: auto-captured system metadata every survey can reference without declaring
 * anything (see `ZEmbeddedDataSource` — reserved fields are never stored as rows).
 *
 * The response location is a typed accessor rather than a dot-path string. Reserved fields are a
 * static catalog in code, so the "path" can be code too — which makes an entry that points at a
 * nonexistent response field a compile error instead of a silent `undefined`, and needs no
 * path-walking machinery whose edge cases would have to be tested separately.
 */
export interface TReservedFieldCatalogEntry {
  /**
   * The key consumers reference the field by — the recall token id, the logic operand, the key in
   * the projected value map. This is the "storageKey" of a reserved field, except nothing is
   * stored: the name only ever addresses catalog reads.
   */
  name: string;
  dataType: TEmbeddedDataType;
  /**
   * Reads the raw value off a response. Coercion to `dataType` is the resolver's job, not the
   * accessor's. Accessors should be total functions; one that throws is treated as "nothing
   * captured" by the resolver rather than crashing the caller.
   */
  read: (response: TEmbeddedValueResponse) => TReservedFieldRawValue;
}

/**
 * The production reserved-field catalog. Deliberately empty: ENG-1836 ships the mechanism, ENG-1839
 * decides the contents. It exists now so call sites (ENG-1837) can wire
 * `projectReservedValues(RESERVED_FIELD_CATALOG, response)` today and light up when the entries
 * land, without another round of call-site changes.
 */
export const RESERVED_FIELD_CATALOG: readonly TReservedFieldCatalogEntry[] = [];

/**
 * The slice of a stored field definition the resolver needs — `TEmbeddedData` minus the ownership
 * and bookkeeping columns. `source` stays the full enum even though `ZEmbeddedData` rejects
 * `"reserved"` rows: narrowing it here would force every caller holding a parsed row to re-prove
 * at runtime what the schema already guaranteed. A row that still claims `"reserved"` resolves to
 * `undefined` (see {@link resolveEmbeddedValue}).
 */
export type TResolvableEmbeddedField = Pick<TEmbeddedData, "source" | "dataType" | "defaultValue" | "locked">;

/** The slice of the survey link the read seam needs: the key the value is stored under in the response. */
export type TEmbeddedDataLink = Pick<TSurveyEmbeddedData, "storageKey">;

/**
 * A reference to one embedded value on a response. Two shapes because the data model has two:
 * a stored field is only addressable through the survey link that carries its `storageKey`, while
 * a reserved field has no link and no storage — only a catalog entry. Modeling this as a union
 * makes the mismatch unrepresentable: there is no way to hand the resolver a catalog entry with a
 * storage key, or a stored field without one.
 *
 * The `?: never` exclusion props are what make that claim actually hold. Against a bare union,
 * TypeScript's excess-property check admits keys from any constituent, so a mixed
 * `{ field, link, entry }` object would compile and the resolver would have to pick a winner
 * silently; with the exclusions it is a compile error instead.
 */
export type TEmbeddedValueRef =
  | { field: TResolvableEmbeddedField; link: TEmbeddedDataLink; entry?: never }
  | { entry: TReservedFieldCatalogEntry; field?: never; link?: never };

/**
 * A stored field definition paired with the survey link that addresses it — the unit
 * {@link listReadableFields} enumerates and {@link deriveLegacyEmbeddedData} synthesizes. The pair
 * is assignable to {@link TEmbeddedValueRef}, so whatever a caller lists it can also resolve,
 * without repackaging.
 */
export interface TLinkedEmbeddedField {
  field: TResolvableEmbeddedField & Pick<TEmbeddedData, "name">;
  link: TEmbeddedDataLink;
}

/**
 * Mirrors the date rule `ZEmbeddedData` pins for `date` default values (kept private there on
 * purpose — this module owns read-side semantics, that one owns the row schema).
 */
const ZIsoDateOrDateTime = z.union([z.iso.date(), z.iso.datetime()]);

/**
 * Coerces a raw stored value to a field's `dataType`, returning `undefined` when the value cannot
 * honestly represent one. This is the single vocabulary of read-side coercion — every tier of
 * {@link resolveEmbeddedValue} (stored value, reserved read, default value) goes through it, so a
 * resolved value always agrees with its declared `dataType` no matter which tier produced it.
 *
 * The rules, and why:
 * - `null`, `undefined` and non-scalars (`string[]`, `Record<string, string>`) are missing. Response
 *   data shares one map with question answers, so a multi-select array or matrix record under the
 *   storage key means the key collided with an element id — joining it into a string would invent a
 *   value the respondent never provided for this field.
 * - `string`: strings pass through unchanged, including `""` — an ingested empty string is a present
 *   value, and whether to display something else is the consumer's fallback logic, not data
 *   semantics. Numbers, booleans and valid dates stringify losslessly.
 * - `number`: finite numbers and non-blank numeric strings. Blank strings are missing, never `0`
 *   (`Number("") === 0` is a coercion artifact, not data).
 * - `boolean`: booleans, and exactly `"true"`/`"false"` (case-insensitive, trimmed) — the URL-param
 *   spelling. `1`/`"yes"`/`"on"` stay uncoercible: guessing truthiness is write-side ingest policy
 *   (ENG-1845), and the read seam must not resolve a value ingest would have rejected.
 * - `date`: `Date` instances become ISO strings; strings must be an ISO 8601 date (`2026-08-06`)
 *   or UTC datetime (`2026-08-06T10:30:00Z`) — the exact subset `ZEmbeddedData` pins for date
 *   defaults. That deliberately excludes offset (`+02:00`) and zone-less datetimes, and, unlike
 *   the number and boolean arms, tolerates no surrounding whitespace — write-side ingest
 *   (ENG-1845) must normalize to this same subset, or consciously widen both rules together.
 *   Accepted strings pass through as-is, so a date-only value is not silently promoted to a
 *   midnight-UTC datetime. Epoch numbers stay uncoercible — nothing upstream produces them
 *   intentionally.
 */
export const coerceToEmbeddedDataType = (
  value: unknown,
  dataType: TEmbeddedDataType
): TResolvedEmbeddedValue | undefined => {
  if (value === null || value === undefined) return undefined;

  switch (dataType) {
    case "string": {
      if (typeof value === "string") return value;
      if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
      if (typeof value === "boolean") return String(value);
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
      return undefined;
    }
    case "number": {
      if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
      if (typeof value === "string") {
        if (value.trim() === "") return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
        return undefined;
      }
      return undefined;
    }
    case "date": {
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
      if (typeof value === "string") return ZIsoDateOrDateTime.safeParse(value).success ? value : undefined;
      return undefined;
    }
  }
};

/**
 * The single read seam for Embedded Data: returns one field's value from a response, or `undefined`
 * when the field has no value there. Every downstream surface (recall, logic, export, pickers)
 * will read through this once ENG-1837 repoints them, so "where does a field's value live" is
 * answered exactly once:
 *
 * - `computed` → `response.variables[storageKey]` (written by the logic engine)
 * - `ingested` → `response.data[storageKey]` (written from URL params / SDK)
 * - reserved catalog entry → wherever its typed accessor points (`meta.*`, `ttc._total`, …)
 *
 * A `locked` ingested field ignores `response.data` entirely — locking means outside writes are
 * refused, so the default IS the value; honoring a stored value here would let a crafted URL
 * override what locking promised. Missing or uncoercible values fall back to the field's
 * `defaultValue` (`null` means "no default"), which is coerced through the same rules, so the
 * result always agrees with the field's `dataType` or is `undefined`. Reserved entries have no
 * default tier: they are captured metadata, and a default would fake a capture that never happened.
 *
 * A stored row whose `source` still claims `"reserved"` resolves to `undefined` — such a row cannot
 * pass `ZEmbeddedData`, so this arm only defends against data that skipped the schema.
 *
 * ENG-1837 swap checklist — two consumer behaviors this seam deliberately does not reproduce; the
 * repointed call sites inherit these deltas and must do so consciously. The mismatched state is
 * realistic today: `performCalculation`'s `assign` (packages/surveys/src/lib/logic.ts) stores raw
 * strings into number variables unconditionally.
 * (a) `getVariableValue` in that same file evaluates a number variable as `Number(value) || 0` (its
 *     text arm collapses falsy values to `""`), so a non-numeric or empty string stored in
 *     `response.variables` is `0` to logic today — here that state is a coercion failure and
 *     resolves to defaultValue-or-`undefined`.
 * (b) Both recall paths (`replaceRecallInfo` in packages/surveys, `parseRecallInfo` in apps/web)
 *     render whatever sits in the lookup maps with no dataType awareness, so the same stored
 *     `"abc"` renders verbatim in recall today — here it resolves to defaultValue-or-`undefined`.
 * (c) On a key present in both maps, today's consumers disagree with each other —
 *     `replaceRecallInfo` lets `responseData` win (its data check runs last), `parseRecallInfo`
 *     lets `variables` win (checked first). Here the declared source is exclusive: computed reads
 *     only `variables`, ingested reads only `data`.
 * (d) A response missing a variable's key entirely (stored before the variable was added, or
 *     API-created) is `0` / `""` to logic and fallback text to recall today — here it resolves to
 *     the field's `defaultValue`, which for §8-derived pairs is the variable's declared value.
 */
export const resolveEmbeddedValue = (
  ref: TEmbeddedValueRef,
  response: TEmbeddedValueResponse
): TResolvedEmbeddedValue | undefined => {
  // Definedness, not `"entry" in ref`: the `entry?: never` exclusion prop keeps the `in` operator
  // from narrowing the union, and this way a degenerate `{ field, link, entry: undefined }` object
  // still resolves through its field instead of crashing on `undefined.read`.
  if (ref.entry !== undefined) {
    // A throwing accessor reads as missing rather than escalating: one dirty response row fed to a
    // computing accessor (e.g. URL parsing) must degrade like every other dirty input here — one
    // field unset — not abort a caller's whole render or export loop over the catalog.
    try {
      return coerceToEmbeddedDataType(ref.entry.read(response), ref.entry.dataType);
    } catch {
      return undefined;
    }
  }

  const { field, link } = ref;
  if (field.source === "reserved") return undefined;

  const storedValue =
    field.source === "computed"
      ? response.variables[link.storageKey]
      : field.locked
        ? undefined
        : response.data[link.storageKey];

  const coerced = coerceToEmbeddedDataType(storedValue, field.dataType);
  if (coerced !== undefined) return coerced;
  if (field.defaultValue === null) return undefined;
  return coerceToEmbeddedDataType(field.defaultValue, field.dataType);
};

/**
 * Finds a computed field by the key its value is stored under in `response.variables`.
 *
 * Returns `undefined` when nothing matches, which is a state that reaches production: a logic
 * condition or a calculate action outlives the field it names whenever a variable is renamed or
 * deleted and the rule keeps the old storage key.
 */
export const findComputedEmbeddedField = (
  computedFields: readonly TLinkedEmbeddedField[],
  storageKey: string
): TLinkedEmbeddedField | undefined => computedFields.find((field) => field.link.storageKey === storageKey);

/**
 * The declared type of the computed field an operand names, or `undefined` when it names none.
 *
 * The optional chain is the point: both logic engines consult this to decide whether to coerce a
 * hidden-field operand to a number, and that decision is made BEFORE the operator switch. Reading
 * `.dataType` off a missing field throws there, and `evaluateSingleCondition`'s try/catch turns the
 * throw into a silent `false` — so a stale operand would quietly change which branch a respondent
 * takes, or what a quota counts, with no error anywhere. Unknown type means the coercion simply does
 * not fire and evaluation falls through exactly as it does for a text variable.
 */
export const getComputedFieldDataType = (
  computedFields: readonly TLinkedEmbeddedField[],
  storageKey: string
): TEmbeddedDataType | undefined => findComputedEmbeddedField(computedFields, storageKey)?.field.dataType;

/**
 * What the logic engines read a computed field's value as — **not** {@link resolveEmbeddedValue}.
 *
 * ENG-1837 repointed the *definition* lookup onto the EmbeddedData tables and deliberately left this
 * value expression alone. `resolveEmbeddedValue` would coerce a non-numeric stored value to the
 * field's declared default instead of `0`, and render a text field holding `0` as `"0"` rather than
 * `""` — both of which change what already-stored responses evaluate to, and responses are never
 * migrated (see the swap checklist on {@link resolveEmbeddedValue}, deltas (a) and (d)).
 *
 * Shared by `packages/surveys/src/lib/logic.ts` (the renderer) and `apps/web/lib/surveyLogic/utils.ts`
 * (quotas, summaries, follow-up conditions), which are near-copies of each other. It lives here so
 * the rule has one definition rather than two that can drift apart — the engines evaluating the same
 * survey differently is its own bug class.
 */
export const getLogicVariableValue = (
  computedFields: readonly TLinkedEmbeddedField[],
  storageKey: string,
  variablesData: TResponseVariables
): string | number | undefined => {
  const field = findComputedEmbeddedField(computedFields, storageKey);
  if (!field) return undefined;
  const variableValue = variablesData[storageKey];
  return field.field.dataType === "number" ? Number(variableValue) || 0 : variableValue || "";
};

/**
 * Resolves every catalog entry into a plain map keyed by entry name — the piece that lets reserved
 * fields ride through recall and logic with zero per-consumer special-casing. Those consumers
 * already read two maps (`variables[...]`, `responseData[...]`); merging this projection into
 * either one makes reserved values reachable by name exactly like every other field, which matters
 * because `response.meta` is not otherwise passed into the recall/logic resolvers at all.
 *
 * The value type is deliberately `string | number` so the result is assignable into both existing
 * maps: absent values are omitted (recall then falls back to its fallback text and logic sees
 * `undefined`, exactly like an absent hidden field today), and booleans are stringified to
 * `"true"`/`"false"` — what `String()` would render anyway, in a map type that has no boolean slot.
 *
 * An entry name that matches an element id or hidden field name shadows it in the merged map, and
 * `FORBIDDEN_IDS` guards none of the names §9b proposes — so ENG-1839 picks names knowing that.
 */
export const projectReservedValues = (
  entries: readonly TReservedFieldCatalogEntry[],
  response: TEmbeddedValueResponse
): Record<string, string | number> => {
  const values: Record<string, string | number> = {};
  for (const entry of entries) {
    const value = resolveEmbeddedValue({ entry }, response);
    if (value === undefined) continue;
    values[entry.name] = typeof value === "boolean" ? String(value) : value;
  }
  return values;
};

/** One referenceable field, carrying the key a consumer must use to address it. */
export interface TReadableField {
  /** The reference key: element id, link `storageKey`, catalog entry name, or contact attribute key. */
  key: string;
  /** Display label for pickers. Falls back to the key when nothing better exists. */
  label: string;
}

/**
 * Everything a survey can reference, grouped. All four groups are always present (empty arrays
 * included) so consumers render stable sections instead of probing for keys. Contact attributes
 * stay their own clearly-labelled group — they describe the person, not the response, and the
 * unified picker must not blur that line.
 */
export interface TReadableFields {
  question: TReadableField[];
  embeddedData: TReadableField[];
  reserved: TReadableField[];
  contactAttribute: TReadableField[];
}

/**
 * Inputs are explicit: the field/link pairs don't live on `TSurvey` until ENG-1837 inlines them,
 * contact attribute keys are workspace-level, the reserved catalog is code — and `blocks`, which
 * does live on `TSurvey`, is taken alone so the function needs no survey object. Passing them in
 * keeps this pure and lets legacy surveys participate via {@link deriveLegacyEmbeddedData}.
 */
export interface TListReadableFieldsInput {
  /** The survey's blocks — elements live here (the legacy `questions` model is not enumerated). */
  blocks: TSurveyBlocks;
  embeddedData: readonly TLinkedEmbeddedField[];
  reservedEntries: readonly TReservedFieldCatalogEntry[];
  contactAttributeKeys: readonly Pick<TContactAttributeKey, "key" | "name">[];
  /** Language for element headlines; falls back to each headline's `default` entry. */
  languageCode?: string;
}

/**
 * Matches one full recall token (`#recall:<id>/fallback:<text>#`) — the editor's storage syntax.
 * `.replace()` only: `.test()`/`.exec()` would carry `lastIndex` across calls on this shared instance.
 */
const RECALL_TOKEN_REGEX = /#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/g;

/**
 * A blank label draws a row with nothing to read or click (the same reasoning behind
 * `ZEmbeddedData`'s name rule), and not every source guarantees a non-blank name — legacy variable
 * names and contact attribute display names are plain strings. The reference key always exists, so
 * it is the fallback, applied uniformly to all four groups.
 */
const labelOrKey = (label: string, key: string): string => (label.trim() === "" ? key : label);

/**
 * Headline → picker label: localized, HTML stripped so rich-text markup never shows raw, and recall
 * tokens flattened to `___` so storage syntax never leaks into a picker (what the apps/web pickers
 * achieve via `replaceRecallInfoWithUnderline`). Localization follows packages/surveys'
 * `getLocalizedValue` — a blank or missing locale entry falls back to the `default` entry. That is
 * deliberately NOT today's apps/web picker behavior, whose `getLocalizedValue` has no default
 * fallback, so an untranslated headline labels there as the bare element id; ENG-1840/1853 inherit
 * this as a conscious label improvement when they swap pickers onto {@link listReadableFields}.
 */
const toElementLabel = (headline: TI18nString, languageCode: string): string => {
  const localized = headline[languageCode];
  const fallback = typeof headline.default === "string" ? headline.default : "";
  const raw = typeof localized === "string" && localized.trim() !== "" ? localized : fallback;
  return getTextContent(raw).replace(RECALL_TOKEN_REGEX, "___").trim();
};

/**
 * Enumerates everything referenceable from a survey — the one list recall pickers, logic builders
 * and export columns will all read (ENG-1840/1853), so "what can I reference and by which key"
 * has a single answer. Each entry's `key` is the exact string {@link resolveEmbeddedValue} and the
 * existing map lookups address the value by:
 *
 * - question → the element id (label from its headline; the id itself when the headline is empty)
 * - embeddedData → the link's `storageKey` (never the definition's library `key` — the storage key
 *   is what recall tokens and response maps use, and the two can differ)
 * - reserved → the catalog entry name (title-cased for the label until the picker adds real labels)
 * - contactAttribute → the contact attribute key (label from its display name when one is set)
 */
export const listReadableFields = (input: TListReadableFieldsInput): TReadableFields => {
  const languageCode = input.languageCode ?? "default";

  const question = input.blocks
    .flatMap((block) => block.elements)
    .map((element) => ({
      key: element.id,
      label: labelOrKey(toElementLabel(element.headline, languageCode), element.id),
    }));

  const embeddedData = input.embeddedData.map(({ field, link }) => ({
    key: link.storageKey,
    label: labelOrKey(field.name, link.storageKey),
  }));

  const reserved = input.reservedEntries.map((entry) => ({
    key: entry.name,
    label: labelOrKey(formatSnakeCaseToTitleCase(entry.name), entry.name),
  }));

  const contactAttribute = input.contactAttributeKeys.map((attributeKey) => ({
    key: attributeKey.key,
    label: labelOrKey(attributeKey.name ?? "", attributeKey.key),
  }));

  return { question, embeddedData, reserved, contactAttribute };
};

/**
 * Maps a survey's legacy declarations (`variables`, `hiddenFields.fieldIds`) into the same
 * field/link pairs the resolver and enumerator consume — the pure-function fallback that lets
 * ENG-1837 serve surveys whose rows haven't been backfilled (migration spec §8), with no fetch
 * logic here.
 *
 * The §8 rules live in `toDesiredEmbeddedFields`, shared with ENG-1978's write bridge and ENG-1835's
 * backfill; this only reshapes them into `{field, link}` pairs and adds `locked: false`, which has no
 * legacy equivalent.
 *
 * `hiddenFields.enabled` is deliberately ignored: recall and logic consult `fieldIds` alone today,
 * and ingestion is split on the flag — the js-core SDK drops hidden fields when disabled, while the
 * link-survey URL path fills them regardless (`getHiddenFieldsFromSearchParams` receives only
 * `fieldIds`). Deriving from `fieldIds` alone therefore preserves today's read behavior exactly:
 * whatever either path stored still resolves, and what nothing stored reports as unset.
 */
export const deriveLegacyEmbeddedData = (survey: TLegacyEmbeddedFields): TLinkedEmbeddedField[] =>
  toDesiredEmbeddedFields(survey).map(({ storageKey, ...field }) => ({
    field: { ...field, locked: false },
    link: { storageKey },
  }));

/**
 * The survey slice {@link getSurveyEmbeddedFields} needs. Deliberately looser than `TSurvey`: the
 * readers this serves hold everything from a full survey to a four-key `Pick`, and every one of them
 * must be able to call the accessor without widening its own select.
 */
export interface TEmbeddedFieldsSurvey extends TLegacyEmbeddedFields {
  /** The rows, joined and inlined at load. Absent when the select omitted the join. */
  embeddedFields?: TLinkedEmbeddedField[] | null;
}

/**
 * **Where a saved survey's Embedded Data definitions come from.** Every reader outside the editor —
 * recall, logic, export columns, response filters, response tables, emails, integrations — calls
 * this and nothing else. Its counterpart is {@link getDeclaredEmbeddedFields}; between the two, no
 * reader may call {@link deriveLegacyEmbeddedData} directly, which is what keeps "exactly two named
 * decisions, and no third" a property a reviewer can check with grep.
 *
 * **The rows are the whole answer** (ENG-2412). This used to fall back to the legacy columns for a
 * survey with no rows, which is why deleting a survey's rows made its fields reappear rather than
 * disappear. The write path now writes the rows from the payload, so a survey with no rows is a
 * survey with no fields, and that is what this reports.
 *
 * **Every survey select that reaches a reader must therefore carry the join** —
 * `selectSurveyEmbeddedDataLinks`, inlined by `transformPrismaSurvey`. A select that omits it yields
 * `undefined` here and the survey reads as having no fields at all. Audited when the fallback was
 * removed: every reader gets its survey through `selectSurvey` or a select that embeds the same
 * constant.
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

/**
 * **What a survey declares right now, ignoring what is stored.** The counterpart to
 * {@link getSurveyEmbeddedFields}; between the two, no caller needs
 * {@link deriveLegacyEmbeddedData} directly, so "which of two named decisions does this reader
 * make" stays a property a reviewer can check with grep.
 *
 * Two groups of callers need this rather than the stored rows:
 *
 * 1. **The editor.** Its working copy is cloned from the server survey at mount and never
 *    re-fetched, while the rows are only written on save — so an inlined `embeddedFields` is stale
 *    from the first card edit until the next save. Deriving is what makes a rename or a newly added
 *    field show up in the pickers, the logic builder, the calculate widget, the follow-up recipient
 *    list and the preview on the next render. Note this cannot be fixed by reshaping the working
 *    copy instead: it is compared against the server survey with a key-count-sensitive deep equal
 *    to gate the draft auto-save, the discard-changes dialog and the beforeunload prompt, and a
 *    save round-trip puts the server's shape back anyway.
 * 2. **Recall labelling** (`apps/web/lib/utils/recall.ts`). A recall token's label is authoring
 *    syntax: the picker writes `@label` into the text and the label resolver reads it back, so the
 *    two must agree on the same instant's definitions or the round-trip desyncs — a field added
 *    since the last save would render as a raw `#recall:…#` token, and a renamed one would stop
 *    matching. The same functions also label saved surveys for exports and summaries, where this is
 *    a no-op — a saved survey's rows and declarations agree element for element, because every write
 *    path that persists those columns calls `reconcileEmbeddedData` in the same transaction with the
 *    same payload it wrote them from (ENG-2412 moved that call onto the payload; before it, onto the
 *    row just written). There are exactly four: `updateSurveyInternal` and `createSurvey`
 *    (apps/web/lib/survey/service.ts), the copy flow (modules/survey/list/lib/survey.ts) and the v3
 *    patch (app/api/v3/surveys/patch.ts) — a `reconcileEmbeddedData(` grep is the audit, and a fifth
 *    write that skips it reintroduces the divergence. They can also diverge once a shared library definition can be renamed independently
 *    of the survey (ENG-1851), which is when the unified picker (ENG-1853) moves recall and the
 *    pickers onto the tables together.
 */
// Takes the same survey slice as {@link getSurveyEmbeddedFields}, not the narrower legacy one, so a
// caller holding a full survey can pass it and the "ignores the stored rows" contract is visible in
// the signature rather than enforced by which keys happen to be omitted at the call site.
export const getDeclaredEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  deriveLegacyEmbeddedData(survey);

/** The computed (ex-variable) fields a survey declares right now. */
export const getDeclaredComputedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  getDeclaredEmbeddedFields(survey).filter(({ field }) => field.source === "computed");

/** The storage keys of the ingested (ex-hidden) fields a survey declares right now. */
export const getDeclaredIngestedStorageKeys = (survey: TEmbeddedFieldsSurvey): string[] =>
  getDeclaredEmbeddedFields(survey)
    .filter(({ field }) => field.source === "ingested")
    .map(({ link }) => link.storageKey);
