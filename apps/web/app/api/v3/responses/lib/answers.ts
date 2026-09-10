import { listReadableFields } from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import { MAX_RESPONSE_TTC } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { localizeSurveyString } from "./label-resolution";
import {
  type TV3ResponseAnswer,
  type TV3ResponseSelection,
  type TV3ResponseUnresolvedEntry,
  type TV3ResponseValueMatch,
  V3_ADDRESS_FIELD_IDS,
  V3_CONTACT_INFO_FIELD_IDS,
} from "./resources";

/**
 * Turning `Response.data` into the contract's typed `answers[]`.
 *
 * The stored map is flat, untyped and shared with hidden-field values, so every branch here is a
 * narrowing of `unknown`. Nothing throws: a value whose shape does not fit its element becomes an
 * `unresolved[]` entry with the raw value intact and the walk continues. A serializer that throws on
 * one odd row makes the whole page 500, and these rows are years old and were written by several
 * client versions.
 */

/** Everything about a survey that answer serialization needs, computed once per survey per language. */
export interface TV3AnswerPlan {
  /** 1-based position in the flattened block order, which is the order a respondent saw. */
  positionById: Map<string, number>;
  elementById: Map<string, TSurveyElement>;
  /** Headlines, already localized, HTML-stripped and recall-flattened. */
  labelById: Map<string, string>;
  lookupKey: string;
}

export const buildAnswerPlan = (blocks: TSurveyBlock[], lookupKey: string): TV3AnswerPlan => {
  const elements = blocks.flatMap((block) => block.elements);

  // Reused rather than reimplemented: `toElementLabel` localizes with the `default` fallback, strips
  // rich text and flattens recall tokens, and `labelOrKey` falls back to the element id when the
  // result is blank. Both are module-private, and this is the exported way to reach them. Emitting a
  // raw `#recall:…#` token or a `<p>` into an API payload is the failure this avoids.
  const readable = listReadableFields({
    blocks,
    embeddedData: [],
    reservedEntries: [],
    contactAttributeKeys: [],
    languageCode: lookupKey,
  });

  return {
    positionById: new Map(elements.map((element, index) => [element.id, index + 1])),
    elementById: new Map(elements.map((element) => [element.id, element])),
    labelById: new Map(readable.question.map(({ key, label }) => [key, label])),
    lookupKey,
  };
};

const MAX_DURATION_SECONDS = MAX_RESPONSE_TTC / 1000;

/**
 * Milliseconds to seconds, clamped into the range the contract publishes.
 *
 * The stored `ZResponseTtc` is deliberately unbounded so rows written before the ENG-1083 write-side
 * clamp still parse, which means a real row can hold a negative value or a tab left open for days.
 * Clamping on read keeps the published `minimum`/`maximum` true of every row; returning the raw value
 * would make the API violate its own schema on legitimate historical data.
 *
 * Rounded to milliseconds' worth of precision so `performance.now()` float noise does not surface as
 * `4.3216000000000005`.
 */
const toDurationSeconds = (milliseconds: unknown): number | undefined => {
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds)) {
    return undefined;
  }

  return Math.round(Math.min(Math.max(milliseconds, 0), MAX_RESPONSE_TTC)) / 1000;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === "string");

/**
 * Whether this element offers an "Other" write-in at all.
 *
 * The renderer's own test. Deliberately **not** `otherOptionPlaceholder !== undefined`: deleting the
 * Other choice in the editor removes the choice without clearing the placeholder, so that predicate
 * stays true forever once set and would misfile every unmatched value as a write-in.
 */
const hasOtherChoice = (element: TSurveyElement): boolean =>
  "choices" in element &&
  Array.isArray(element.choices) &&
  element.choices.some((choice: { id: string }) => choice.id === "other");

/**
 * Resolve one stored choice value against the current definition.
 *
 * Order is load-bearing and matches the contract: an option **id**, then an option **label**, then
 * `other`, then `unmatched`. The `other` step is last-but-one because a renamed option and a genuine
 * write-in are byte-identical as stored — so an element with no Other input can never report `other`,
 * and one with an Other input reports it only when nothing else resolved.
 *
 * `unmatched` keeps `rawValue` and nulls the ids rather than guessing. The value is never discarded.
 */
const resolveSelection = (
  raw: string,
  element: TSurveyElement,
  lookupKey: string,
  rank?: number
): TV3ResponseSelection => {
  const choices = "choices" in element && Array.isArray(element.choices) ? element.choices : [];

  for (const choice of choices) {
    if (choice.id === raw) {
      const label = "label" in choice ? localizeSurveyString(choice.label, lookupKey) : "";
      return {
        optionId: choice.id,
        optionLabel: label || null,
        rawValue: raw,
        match: "exact",
        ...rankOf(rank),
      };
    }
  }

  for (const choice of choices) {
    if (!("label" in choice)) continue;
    if (localizeSurveyString(choice.label, lookupKey) === raw) {
      return { optionId: choice.id, optionLabel: raw, rawValue: raw, match: "label", ...rankOf(rank) };
    }
  }

  const match: TV3ResponseValueMatch = hasOtherChoice(element) ? "other" : "unmatched";
  return { optionId: null, optionLabel: null, rawValue: raw, match, ...rankOf(rank) };
};

const rankOf = (rank?: number): { rank?: number } => (rank === undefined ? {} : { rank });

/** The sub-field ids and their placeholder configs, in the fixed storage order for each type. */
const compositeFields = (element: TSurveyElement): readonly string[] =>
  element.type === "address" ? V3_ADDRESS_FIELD_IDS : V3_CONTACT_INFO_FIELD_IDS;

type Serialized = { answer: TV3ResponseAnswer } | { reason: TV3ResponseUnresolvedEntry["reason"] };

/**
 * One stored value to one answer, or a reason it could not be read.
 *
 * Every branch narrows before it reads. `valueShapeMismatch` is returned rather than thrown, and
 * rather than coerced — a `matrix` element holding a string is a real row somewhere, and guessing
 * what it meant invents data.
 */
const serializeOne = (
  element: TSurveyElement,
  raw: unknown,
  base: { position: number; elementId: string; elementLabel: string; durationSeconds?: number },
  lookupKey: string
): Serialized => {
  const mismatch = { reason: "valueShapeMismatch" as const };

  switch (element.type) {
    case "openText": {
      // Always a string, `inputType: number` included — the contract says so and the renderer agrees.
      if (typeof raw !== "string") return mismatch;
      return {
        answer: {
          ...base,
          elementType: "openText",
          valueText: raw,
          ...(element.inputType ? { inputType: element.inputType } : {}),
        },
      };
    }

    case "nps": {
      if (typeof raw !== "number") return mismatch;
      // Hardcoded because `ZSurveyNPSElement` declares neither `range` nor `scale`: NPS is 0-10 by
      // definition. Falling back to the base element's `range` would be wrong — its union omits 0.
      return { answer: { ...base, elementType: "nps", valueNumber: raw, range: { min: 0, max: 10 } } };
    }

    case "rating":
    case "csat":
    case "ces": {
      if (typeof raw !== "number") return mismatch;
      return {
        answer: {
          ...base,
          elementType: element.type,
          valueNumber: raw,
          range: { min: 1, max: element.range },
          scale: element.scale,
        },
      };
    }

    case "consent": {
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "consent", valueBoolean: raw === "accepted", rawValue: raw } };
    }

    case "cta": {
      // Legacy rows also hold `"dismissed"`, which is a real skip and reads as `false`.
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "cta", valueBoolean: raw === "clicked", rawValue: raw } };
    }

    case "cal": {
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "cal", booked: raw === "booked", rawValue: raw } };
    }

    case "date": {
      // Verbatim. Rows written by older clients carry the element's display format rather than an
      // ISO day, and reformatting one without knowing which it is would move the date.
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "date", valueDate: raw } };
    }

    case "fileUpload": {
      if (!isStringArray(raw)) return mismatch;
      return { answer: { ...base, elementType: "fileUpload", fileUrls: raw, fileCount: raw.length } };
    }

    case "address":
    case "contactInfo": {
      // A fixed-length positional array, blanks included. Every slot is emitted, because dropping an
      // empty one shifts every later value onto the wrong field and makes the stored array
      // unreconstructable. Slots the author has switched off are stored as `""` too.
      if (!isStringArray(raw)) return mismatch;
      const ids = compositeFields(element);
      return {
        answer: {
          ...base,
          elementType: element.type,
          fields: ids.map((fieldId, slot) => ({
            slot,
            fieldId: fieldId as
              | (typeof V3_ADDRESS_FIELD_IDS)[number]
              | (typeof V3_CONTACT_INFO_FIELD_IDS)[number],
            fieldLabel: localizeSurveyString(
              (
                element as unknown as Record<
                  string,
                  { placeholder?: Parameters<typeof localizeSurveyString>[0] }
                >
              )[fieldId]?.placeholder,
              lookupKey
            ),
            valueText: raw[slot] ?? "",
          })),
        },
      };
    }

    case "matrix": {
      // Keyed by the **localized row label** in the respondent's language, valued by the localized
      // column label — never ids. So `rawKey` is what rebuilds the stored object, and `rowLabel` is
      // that row resolved in the *current* language, which can differ.
      if (!isStringRecord(raw)) return mismatch;
      return {
        answer: {
          ...base,
          elementType: "matrix",
          rows: Object.entries(raw).map(([rawKey, rawValue]) => {
            const row = element.rows.find((entry) => localizeSurveyString(entry.label, lookupKey) === rawKey);
            const column = element.columns.find(
              (entry) => localizeSurveyString(entry.label, lookupKey) === rawValue
            );
            return {
              rawKey,
              rowId: row?.id ?? null,
              rowLabel: row ? localizeSurveyString(row.label, lookupKey) : rawKey,
              columnId: column?.id ?? null,
              columnLabel: column ? localizeSurveyString(column.label, lookupKey) : null,
              rawValue,
              match: column ? ("label" as const) : ("unmatched" as const),
            };
          }),
        },
      };
    }

    case "multipleChoiceSingle": {
      if (typeof raw !== "string") return mismatch;
      return {
        answer: {
          ...base,
          elementType: "multipleChoiceSingle",
          selections: [resolveSelection(raw, element, lookupKey)],
        },
      };
    }

    case "multipleChoiceMulti":
    case "pictureSelection": {
      // `pictureSelection` stores choice **ids**, so it resolves `exact` and carries no label —
      // `ZSurveyPictureChoice` has none. `multipleChoiceMulti` stores localized labels.
      if (!isStringArray(raw)) return mismatch;
      return {
        answer: {
          ...base,
          elementType: element.type,
          selections: raw.map((entry) => resolveSelection(entry, element, lookupKey)),
        },
      };
    }

    case "ranking": {
      // Stored in drag order, so the array index is the rank.
      if (!isStringArray(raw)) return mismatch;
      return {
        answer: {
          ...base,
          elementType: "ranking",
          selections: raw.map((entry, index) => resolveSelection(entry, element, lookupKey, index + 1)),
        },
      };
    }

    default:
      return mismatch;
  }
};

/**
 * Split `Response.data` into resolved answers and everything that could not be read as one.
 *
 * Answers come back in survey order rather than storage order, because the stored map's key order is
 * whatever the client happened to send. Keys with no element in the current definition are the
 * caller's to interpret, so they land in `unresolved[]` rather than being dropped — that collection
 * is the whole reason a renamed or deleted element does not silently lose data.
 */
export const serializeAnswers = (
  plan: TV3AnswerPlan,
  data: TResponseData,
  ttc: TResponseTtc | undefined
): { answers: TV3ResponseAnswer[]; unresolved: TV3ResponseUnresolvedEntry[] } => {
  const answers: TV3ResponseAnswer[] = [];
  const unresolved: TV3ResponseUnresolvedEntry[] = [];

  for (const [key, raw] of Object.entries(data)) {
    const element = plan.elementById.get(key);
    if (!element) {
      // Either a deleted element or a declared hidden field; the two are indistinguishable here,
      // because both live in this one map and nothing records which wrote the key.
      unresolved.push({
        key,
        rawValue: raw as TV3ResponseUnresolvedEntry["rawValue"],
        reason: "elementNotInSurvey",
      });
      continue;
    }

    const result = serializeOne(
      element,
      raw,
      {
        position: plan.positionById.get(key) ?? 1,
        elementId: key,
        elementLabel: plan.labelById.get(key) ?? key,
        ...withDuration(ttc?.[key]),
      },
      plan.lookupKey
    );

    if ("reason" in result) {
      unresolved.push({
        key,
        rawValue: raw as TV3ResponseUnresolvedEntry["rawValue"],
        reason: result.reason,
      });
      continue;
    }

    answers.push(result.answer);
  }

  answers.sort((a, b) => a.position - b.position);

  return { answers, unresolved };
};

const withDuration = (milliseconds: unknown): { durationSeconds?: number } => {
  const seconds = toDurationSeconds(milliseconds);
  return seconds === undefined ? {} : { durationSeconds: seconds };
};

export const V3_MAX_DURATION_SECONDS = MAX_DURATION_SECONDS;
