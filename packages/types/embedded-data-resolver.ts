import { z } from "zod";
import type { TContactAttributeKey } from "./contact-attribute-key";
import type { TEmbeddedData, TEmbeddedDataType, TSurveyEmbeddedData } from "./embedded-data";
import type { TI18nString } from "./i18n";
import type { TResponse } from "./responses";
import { formatSnakeCaseToTitleCase } from "./safe-identifier";
import type { TSurveyBlocks } from "./surveys/blocks";
import type { TSurveyHiddenFields, TSurveyVariables } from "./surveys/types";
import { getTextContent } from "./surveys/validation";

/**
 * What a resolved Embedded Data value can be. A `date` field resolves to its ISO 8601 string, not a
 * `Date` — recall and logic operate on strings and numbers, and recall already date-formats ISO
 * strings for display. Booleans exist only for reserved fields (e.g. `finished`); the projection
 * into the recall/logic maps stringifies them, see {@link projectReservedValues}.
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
  /** Reads the raw value off a response. Coercion to `dataType` is the resolver's job, not the accessor's. */
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
 * - `date`: `Date` instances become ISO strings; strings must already be ISO 8601 (date or
 *   datetime — the same rule `ZEmbeddedData` enforces on date defaults) and pass through as-is, so
 *   a date-only value is not silently promoted to a midnight-UTC datetime. Epoch numbers stay
 *   uncoercible — nothing upstream produces them intentionally.
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
 * reads through this so "where does a field's value live" is answered exactly once:
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
 */
export const resolveEmbeddedValue = (
  ref: TEmbeddedValueRef,
  response: TEmbeddedValueResponse
): TResolvedEmbeddedValue | undefined => {
  // Definedness, not `"entry" in ref`: the `entry?: never` exclusion prop keeps the `in` operator
  // from narrowing the union, and this way a degenerate `{ field, link, entry: undefined }` object
  // still resolves through its field instead of crashing on `undefined.read`.
  if (ref.entry !== undefined) {
    return coerceToEmbeddedDataType(ref.entry.read(response), ref.entry.dataType);
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
 * Inputs are explicit because none of them live on `TSurvey` today: the field/link pairs arrive
 * with ENG-1837, contact attribute keys are workspace-level, and the reserved catalog is code.
 * Passing them in keeps this pure and lets legacy surveys participate via
 * {@link deriveLegacyEmbeddedData}.
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

/** Matches one full recall token (`#recall:<id>/fallback:<text>#`) — the editor's storage syntax. */
const RECALL_TOKEN_REGEX = /#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/g;

/**
 * A blank label draws a row with nothing to read or click (the same reasoning behind
 * `ZEmbeddedData`'s name rule), and not every source guarantees a non-blank name — legacy variable
 * names and contact attribute display names are plain strings. The reference key always exists, so
 * it is the fallback, applied uniformly to all four groups.
 */
const labelOrKey = (label: string, key: string): string => (label.trim() === "" ? key : label);

/**
 * Headline → picker label. Mirrors what `getRecallItemLabel` (apps/web) produces: localized with
 * blank-falls-back-to-`default` semantics, HTML stripped so rich-text markup never shows raw, and
 * nested recall tokens flattened to `___` — a headline that recalls another answer would otherwise
 * leak storage syntax into the picker. Both steps are cheap (one parse, one regex pass).
 */
const toElementLabel = (headline: TI18nString, languageCode: string): string => {
  const localized = headline[languageCode];
  const raw = typeof localized === "string" && localized.trim() !== "" ? localized : (headline.default ?? "");
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
 * Per §8: a variable becomes a `computed` field of its declared type whose `defaultValue` is the
 * variable's value, addressed by its existing cuid (recall tokens and stored responses already use
 * it); a hidden field becomes an `ingested` string field with no default, addressed by its name.
 * `hiddenFields.enabled` is deliberately ignored: recall and logic consult `fieldIds` alone today,
 * and a disabled field simply never receives a value — the resolver then reports it as unset, which
 * is the same behavior with honest mechanics.
 */
export const deriveLegacyEmbeddedData = (survey: {
  variables: TSurveyVariables;
  hiddenFields: TSurveyHiddenFields;
}): TLinkedEmbeddedField[] => {
  const fromVariables = survey.variables.map(
    (variable): TLinkedEmbeddedField => ({
      field: {
        name: variable.name,
        source: "computed",
        dataType: variable.type === "number" ? "number" : "string",
        defaultValue: variable.value,
        locked: false,
      },
      link: { storageKey: variable.id },
    })
  );

  const fromHiddenFields = (survey.hiddenFields.fieldIds ?? []).map(
    (fieldId): TLinkedEmbeddedField => ({
      field: {
        name: fieldId,
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        locked: false,
      },
      link: { storageKey: fieldId },
    })
  );

  return [...fromVariables, ...fromHiddenFields];
};
