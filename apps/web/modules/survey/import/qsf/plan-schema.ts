import { z } from "zod";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";

/**
 * The AI plan for a Qualtrics import (ENG-3479, option B): which Formbricks type each question
 * becomes, which of its option lists plays which role, and one plain-language line per logic rule.
 * Nothing more. Blocks are not the AI's to decide: one Qualtrics page is one block (ENG-3410), and the
 * assembly builds them from the reader's pages.
 *
 * The plan holds refs (`QID3`), text keys (`c12`), enums, booleans and numbers. No field in it is a URL
 * or text that lands in the survey: the assembly copies every text from the file by key. The only free
 * text is `logicNotes` and skip reasons, which go to the report alone, cleaned and capped.
 *
 * One flat schema with a `type` enum and nullable role fields, not a union per type: unions do not
 * survive every provider's JSON-schema conversion (see `generate/schemas.ts`), and the code checks in
 * `plan-checks.ts` enforce which fields each type uses — the same strength, provider-safe.
 */

/**
 * The element types an import may produce. Never `pictureSelection` (it needs image URLs), `cal` (an
 * external host) or `address`; a CTA is always built without an external button.
 */
export const QSF_PLAN_ELEMENT_TYPES = [
  "openText",
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "matrix",
  "nps",
  "rating",
  "csat",
  "ces",
  "ranking",
  "date",
  "fileUpload",
  "contactInfo",
  "consent",
  "cta",
] as const satisfies readonly `${TSurveyElementTypeEnum}`[];

export type TQsfPlanElementType = (typeof QSF_PLAN_ELEMENT_TYPES)[number];

export const QSF_PLAN_CONTACT_FIELDS = ["firstName", "lastName", "email", "phone", "company"] as const;
export type TQsfPlanContactField = (typeof QSF_PLAN_CONTACT_FIELDS)[number];

export const QSF_PLAN_INPUT_TYPES = ["text", "email", "url", "number", "phone"] as const;
export const QSF_PLAN_SCALES = ["number", "smiley", "star"] as const;
/** As strings for the AI, like Create with AI's ranges: numeric enums do not survive every provider. */
export const QSF_PLAN_RANGES = ["3", "4", "5", "6", "7", "10"] as const;
export const QSF_PLAN_DATE_FORMATS = ["M-d-y", "d-M-y", "y-M-d"] as const;

const ZOptionSource = z.enum(["choices", "answers"]);

/**
 * What the provider is asked for. String enums only, no preprocess or transforms: those do not survive
 * the JSON-schema conversion structured output goes through.
 */
export const ZQsfImportPlanForAI = z.object({
  questions: z
    .array(
      z.object({
        ref: z.string().describe("The question's ref, e.g. QID3"),
        type: z.enum(QSF_PLAN_ELEMENT_TYPES),
        required: z.boolean(),
        choicesFrom: ZOptionSource.nullable(),
        rowsFrom: ZOptionSource.nullable(),
        columnsFrom: ZOptionSource.nullable(),
        otherChoiceKey: z.string().nullable(),
        noneChoiceKey: z.string().nullable(),
        labelKey: z.string().nullable(),
        excludedKeys: z.array(z.string()),
        contactFields: z.array(z.object({ field: z.enum(QSF_PLAN_CONTACT_FIELDS), key: z.string() })),
        inputType: z.enum(QSF_PLAN_INPUT_TYPES).nullable(),
        scale: z.enum(QSF_PLAN_SCALES).nullable(),
        range: z.enum(QSF_PLAN_RANGES).nullable(),
        format: z.enum(QSF_PLAN_DATE_FORMATS).nullable(),
        logicNotes: z.array(z.string()).describe("One sentence per logic rule of the question"),
      })
    )
    .describe("Every question that becomes a Formbricks question"),
  skipped: z
    .array(z.object({ ref: z.string(), reason: z.string().describe("Why, in one short sentence") }))
    .describe("Questions Formbricks cannot represent"),
  pages: z
    .array(
      z.object({
        id: z.string().describe("The page's id, e.g. p3"),
        logicNotes: z.array(z.string()).describe("One sentence per branch or randomizer rule of the page"),
      })
    )
    .describe("Only pages that have logic rules"),
});

/** Bounds on what comes back, so a hostile or broken response costs a bounded amount to check. */
const MAX_PLAN_ENTRIES = 1_000;
const MAX_KEYS_PER_QUESTION = 400;
const MAX_NOTES_PER_ENTRY = 20;
const MAX_RAW_NOTE_CHARS = 4_000;
const ZRef = z.string().max(20);
const ZKey = z.string().max(20);
const ZRawNotes = z
  .array(z.string().max(MAX_RAW_NOTE_CHARS))
  .max(MAX_PLAN_ENTRIES)
  .transform((notes) => notes.slice(0, MAX_NOTES_PER_ENTRY));

/**
 * What a returned plan is checked against. Lenient where the checks are stricter: `type` is any short
 * string here, and `plan-checks.ts` holds the allowlist, so the allowlist is enforced on every path —
 * including a provider without structured output, or a response that skipped schema validation.
 */
export const ZQsfImportPlanEnvelope = z.object({
  questions: z.array(z.unknown()).max(MAX_PLAN_ENTRIES),
  skipped: z.array(z.unknown()).max(MAX_PLAN_ENTRIES),
  // Optional here: a plan for questions with no page rules has nothing to say about pages.
  pages: z.array(z.unknown()).max(MAX_PLAN_ENTRIES).optional(),
});

export const ZQsfPlanQuestion = z.object({
  ref: ZRef,
  type: z.string().max(40),
  required: z.boolean(),
  choicesFrom: ZOptionSource.nullable(),
  rowsFrom: ZOptionSource.nullable(),
  columnsFrom: ZOptionSource.nullable(),
  otherChoiceKey: ZKey.nullable(),
  noneChoiceKey: ZKey.nullable(),
  labelKey: ZKey.nullable(),
  excludedKeys: z.array(ZKey).max(MAX_KEYS_PER_QUESTION),
  contactFields: z
    .array(z.object({ field: z.enum(QSF_PLAN_CONTACT_FIELDS), key: ZKey }))
    .max(QSF_PLAN_CONTACT_FIELDS.length),
  inputType: z.enum(QSF_PLAN_INPUT_TYPES).nullable(),
  scale: z.enum(QSF_PLAN_SCALES).nullable(),
  range: z.enum(QSF_PLAN_RANGES).nullable(),
  format: z.enum(QSF_PLAN_DATE_FORMATS).nullable(),
  logicNotes: ZRawNotes,
});

export const ZQsfPlanPage = z.object({
  id: ZRef,
  logicNotes: ZRawNotes,
});

export const ZQsfPlanSkip = z.object({
  ref: ZRef,
  reason: z.string().max(MAX_RAW_NOTE_CHARS),
});

export type TQsfPlanQuestion = z.infer<typeof ZQsfPlanQuestion>;
