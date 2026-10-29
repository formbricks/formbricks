import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";

/**
 * Embedded Data as chart fields (ENG-2848).
 *
 * Every record of a submission carries the response's Embedded Data under `metadata.embedded_data`,
 * keyed by the field's display name (ENG-3290). Which names exist depends on the surveys behind a
 * dataset, so these fields cannot sit in the static `FEEDBACK_FIELDS` list: the app lists them per
 * dataset, signs that list into the Cube token, and Cube compiles one dimension per name
 * (`docker/cube/schema/FeedbackRecords.js`).
 *
 * - **Identity is the name.** Two surveys declaring `brand` share one chart field, because their
 *   records share one key. A rename is a new field; records written before it keep the old one.
 * - **The member id is a hash of the name** (`FeedbackRecords.ed_<16 hex>`), not the name itself:
 *   Postgres cuts column aliases at 63 characters, so a long name would collide with its neighbour.
 *   The hash is FNV-1a so the browser and the server compute the same id without `node:crypto`.
 * - **Type**: a name declared with one type everywhere keeps it; a name whose surveys disagree is
 *   read as text, which every value can be. Dates are stored as ISO strings and are read as text.
 */

export const EMBEDDED_FIELD_MEMBER_PATTERN = /^FeedbackRecords\.ed_[0-9a-f]{16}$/;

/** Most Embedded Data fields one dataset offers; matches the cap Cube enforces on the token claim. */
export const MAX_EMBEDDED_CHART_FIELDS = 200;
const MAX_EMBEDDED_FIELD_NAME_BYTES = 512;

export type TEmbeddedChartFieldType = "string" | "number" | "boolean";

export type TEmbeddedChartField = {
  /** Cube member, e.g. `FeedbackRecords.ed_3f2a…`. */
  id: string;
  /** The field name exactly as records store it — also what the builder shows. */
  name: string;
  type: TEmbeddedChartFieldType;
  /** Surveys in the dataset that declare the field, sorted; shown so a merged name is not a surprise. */
  surveyNames: string[];
};

/** What Cube needs per field: the member, the name for Postgres to decode, and how to read it. */
export type TCubeEmbeddedField = { id: string; hex: string; type: TEmbeddedChartFieldType };

export type TEmbeddedFieldSurvey = {
  name: string;
  fields: { name: unknown; dataType: TEmbeddedDataType }[];
};

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

const fnv1a64 = (text: string): string => {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
};

const toHex = (text: string): string =>
  Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const isEmbeddedFieldMember = (member: string): boolean => EMBEDDED_FIELD_MEMBER_PATTERN.test(member);

export const getEmbeddedFieldMemberId = (name: string): string => `FeedbackRecords.ed_${fnv1a64(name)}`;

/**
 * The key a field's value is stored under, or `null` when the writer never publishes one: the same
 * NUL strip and trim, and the same refusal of a blank name or `__proto__` (`buildEmbeddedDataMetadata`
 * in `lib/feedback-source/response-metadata.ts`). Listing a name the writer skips would offer a field
 * that can never hold a value.
 */
export const toStoredEmbeddedFieldName = (name: unknown): string | null => {
  if (typeof name !== "string") return null;
  const key = name.replaceAll("\u0000", "").trim();
  if (!key || key === "__proto__") return null;
  return key;
};

const toChartFieldType = (dataType: TEmbeddedDataType): TEmbeddedChartFieldType =>
  dataType === "number" || dataType === "boolean" ? dataType : "string";

/** Every Embedded Data name the surveys declare, merged by name and sorted for the picker. */
export const collectEmbeddedChartFields = (surveys: TEmbeddedFieldSurvey[]): TEmbeddedChartField[] => {
  const byName = new Map<string, { types: Set<TEmbeddedChartFieldType>; surveyNames: Set<string> }>();

  for (const survey of surveys) {
    for (const field of survey.fields) {
      const name = toStoredEmbeddedFieldName(field.name);
      // Cube accepts names up to 512 UTF-8 bytes; a longer one would get the whole token refused.
      if (!name || new TextEncoder().encode(name).length > MAX_EMBEDDED_FIELD_NAME_BYTES) continue;
      const entry = byName.get(name) ?? { types: new Set(), surveyNames: new Set() };
      entry.types.add(toChartFieldType(field.dataType));
      entry.surveyNames.add(survey.name);
      byName.set(name, entry);
    }
  }

  return [...byName.entries()]
    .map(([name, { types, surveyNames }]) => ({
      id: getEmbeddedFieldMemberId(name),
      name,
      type: types.size === 1 ? [...types][0] : "string",
      surveyNames: [...surveyNames].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_EMBEDDED_CHART_FIELDS);
};

export const toCubeEmbeddedFields = (fields: TEmbeddedChartField[]): TCubeEmbeddedField[] =>
  fields.map((field) => ({
    id: field.id.slice("FeedbackRecords.".length),
    hex: toHex(field.name),
    type: field.type,
  }));
