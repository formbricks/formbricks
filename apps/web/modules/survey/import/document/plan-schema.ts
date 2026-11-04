import { z } from "zod";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import {
  SURVEY_IMPORT_DOCUMENT_PLAN_MAX_LABEL_CHARS,
  SURVEY_IMPORT_DOCUMENT_PLAN_MAX_OPTIONS,
  SURVEY_IMPORT_DOCUMENT_PLAN_MAX_PIECES,
  SURVEY_IMPORT_DOCUMENT_PLAN_MAX_PIECE_CHARS,
  SURVEY_IMPORT_DOCUMENT_PLAN_MAX_RULES,
  SURVEY_IMPORT_MAX_LANGUAGE_CODE_CHARS,
  SURVEY_IMPORT_PLAN_MAX_ENTRIES,
  SURVEY_IMPORT_PLAN_MAX_RAW_NOTE_CHARS,
  SURVEY_IMPORT_PLAN_MAX_REF_CHARS,
  SURVEY_IMPORT_PLAN_MAX_TYPE_CHARS,
} from "../limits";

/**
 * The AI plan for a document import (ENG-6852, decision 17): which lines are questions and which texts
 * of the file each one is made of, its type, its routing, and which languages the file holds. Nothing
 * more.
 *
 * Every text is named by the key of the cell holding it (`C12`), with the language it is in. A cell
 * holding more than one text — a question and its options, `Age group / Choices: 18-24; 25-34` — is
 * split by quoting each piece as an exact substring of the cell, in each language's own cell: the
 * checks (`plan-checks.ts`) refuse a piece that is not in its cell word for word, and the assembly
 * copies it from the cell, never from the plan. So the AI chooses where a text starts and ends, never
 * what it says.
 *
 * One flat schema with nullable and list fields, not a union per type: unions do not survive every
 * provider's JSON-schema conversion (see `generate/schemas.ts`), and the checks enforce which fields
 * each type uses.
 */

/**
 * The element types a document may produce. Never `pictureSelection` (it needs images), `cal` (an
 * external host), `address` or `contactInfo` (their fields are not texts of the file); a CTA is always
 * built without an external button.
 */
export const DOCUMENT_PLAN_ELEMENT_TYPES = [
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
  "consent",
  "cta",
] as const satisfies readonly `${TSurveyElementTypeEnum}`[];

export type TDocumentPlanElementType = (typeof DOCUMENT_PLAN_ELEMENT_TYPES)[number];

/** What a planned entry is: a question of one of the types, the welcome text, or the closing text. */
export const DOCUMENT_PLAN_KINDS = [...DOCUMENT_PLAN_ELEMENT_TYPES, "welcome", "ending"] as const;
export type TDocumentPlanKind = (typeof DOCUMENT_PLAN_KINDS)[number];

export const DOCUMENT_PLAN_INPUT_TYPES = ["text", "email", "url", "number", "phone"] as const;
export const DOCUMENT_PLAN_SCALES = ["number", "smiley", "star"] as const;
/** As strings for the AI, like Create with AI's ranges: numeric enums do not survive every provider. */
export const DOCUMENT_PLAN_RANGES = ["3", "4", "5", "6", "7", "10"] as const;
export const DOCUMENT_PLAN_DATE_FORMATS = ["M-d-y", "d-M-y", "y-M-d"] as const;

/** Routing a question carries: shown only when a condition holds, or a jump after it is answered. */
export const DOCUMENT_PLAN_RULE_KINDS = ["showIf", "skipTo"] as const;
export type TDocumentPlanRuleKind = (typeof DOCUMENT_PLAN_RULE_KINDS)[number];

/**
 * What a rule's condition tests on the question it reads. `isAnyOf` with one value is `equals`;
 * the assembly turns each into the operator Formbricks logic has for that question's type.
 */
export const DOCUMENT_PLAN_OPERATORS = [
  "equals",
  "doesNotEqual",
  "isAnyOf",
  "isGreaterThan",
  "isLessThan",
  "isSubmitted",
  "isSkipped",
] as const;
export type TDocumentPlanOperator = (typeof DOCUMENT_PLAN_OPERATORS)[number];

const ZPieceForAI = z.object({
  language: z.string().describe("The language's code, one of languages[]"),
  cell: z.string().describe("The key of the cell holding the text, e.g. C12"),
  text: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "null for the whole cell; else the exact part of the cell this text is, copied character for character"
    ),
});

const ZOptionForAI = z.object({
  code: z
    .string()
    .nullable()
    .default(null)
    .describe('The code the file gives the option ("1" in "1 = Yes"), copied exactly, or null'),
  isOther: z
    .boolean()
    .default(false)
    .describe('Whether the option is an "Other" that asks the respondent to say what'),
  texts: z.array(ZPieceForAI).nullable().default([]).describe("The option's text, one piece per language"),
});

const ZRuleForAI = z.object({
  kind: z.enum(DOCUMENT_PLAN_RULE_KINDS),
  question: z
    .string()
    .describe(
      "The question the condition reads: its ID as the file writes it (VIS04, 18), or the key of the line it starts on"
    ),
  operator: z.enum(DOCUMENT_PLAN_OPERATORS),
  values: z
    .array(z.string())
    .nullable()
    .default([])
    .describe("The answers compared with: option codes or option texts as the file writes them, or numbers"),
  target: z
    .string()
    .nullable()
    .default(null)
    .describe('skipTo only: the question jumped to, by ID or line key, or "end"; null for showIf'),
});

/**
 * What the provider is asked for. String enums only, no preprocess or transforms: those do not survive
 * the JSON-schema conversion structured output goes through.
 */
export const ZDocumentImportPlanForAI = z.object({
  defaultLanguage: z.string().describe("The BCP-47 code of the file's main language, e.g. en-US"),
  languages: z
    .array(z.string())
    .nullable()
    .default([])
    .describe("Every language the file's texts are in, default first"),
  titleCell: z
    .string()
    .nullable()
    .default(null)
    .describe("The key of the cell holding the survey's title, or null"),
  questions: z
    .array(
      z.object({
        ref: z.string().describe("The key of the line the entry starts on, e.g. R5"),
        kind: z.enum(DOCUMENT_PLAN_KINDS),
        idCell: z
          .string()
          .nullable()
          .default(null)
          .describe("The key of the cell holding the question's ID or number"),
        sectionCell: z
          .string()
          .nullable()
          .default(null)
          .describe("The key of the cell naming the section or block the question is in"),
        required: z.boolean().default(false),
        headline: z
          .array(ZPieceForAI)
          .nullable()
          .default([])
          .describe("The question's text, one piece per language"),
        subheader: z
          .array(ZPieceForAI)
          .nullable()
          .default([])
          .describe("A description under the question, one piece per language"),
        options: z
          .array(ZOptionForAI)
          .nullable()
          .default([])
          .describe("Choices, ranking items or matrix rows"),
        columns: z.array(ZOptionForAI).nullable().default([]).describe("A matrix's columns"),
        lowerLabel: z
          .array(ZPieceForAI)
          .nullable()
          .default([])
          .describe("A scale's low-end label, one piece per language"),
        upperLabel: z
          .array(ZPieceForAI)
          .nullable()
          .default([])
          .describe("A scale's high-end label, one piece per language"),
        dropdown: z.boolean().default(false).describe("Whether the file says the choices show as a dropdown"),
        inputType: z.enum(DOCUMENT_PLAN_INPUT_TYPES).nullable().default(null),
        scale: z.enum(DOCUMENT_PLAN_SCALES).nullable().default(null),
        range: z
          .union([z.enum(DOCUMENT_PLAN_RANGES), z.number()])
          .nullable()
          .default(null),
        format: z.enum(DOCUMENT_PLAN_DATE_FORMATS).nullable().default(null),
        rules: z.array(ZRuleForAI).nullable().default([]),
        logicNotes: z
          .array(z.string())
          .nullable()
          .default([])
          .describe("One sentence per rule, in the file's language"),
      })
    )
    .nullable()
    .default([])
    .describe("Every question, and the welcome and closing texts, that start on the lines asked about"),
  skipped: z
    .array(z.object({ ref: z.string(), reason: z.string().describe("Why, in one short sentence") }))
    .nullable()
    .default([])
    .describe("Questions on the lines asked about that Formbricks cannot represent"),
});

// Bounds on what comes back, so a hostile or broken response costs a bounded amount to check
// (`../limits.ts`).
const ZKey = z.string().max(SURVEY_IMPORT_PLAN_MAX_REF_CHARS);
const ZLabel = z.string().max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_LABEL_CHARS);
const ZLanguage = z.string().max(SURVEY_IMPORT_MAX_LANGUAGE_CODE_CHARS);

const ZPiece = z.object({
  language: ZLanguage,
  cell: ZKey,
  text: z.string().max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_PIECE_CHARS).nullable(),
});
const ZPieces = z.array(ZPiece).max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_PIECES);
// `null` for an empty list, as the model-facing schema lets a JSON-mode provider send it.
const ZOption = z.object({
  code: ZLabel.nullable(),
  isOther: z.boolean(),
  texts: ZPieces.nullish().transform((pieces) => pieces ?? []),
});

/**
 * What a returned plan is checked against. Lenient where the checks are stricter: `kind` is any short
 * string here, and `plan-checks.ts` holds the allowlist, so it is enforced on every path — including a
 * provider without structured output, or a response that skipped schema validation.
 */
export const ZDocumentImportPlanEnvelope = z.object({
  defaultLanguage: ZLanguage,
  languages: z
    .array(ZLanguage)
    .max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_PIECES)
    .nullish()
    .transform((languages) => languages ?? []),
  titleCell: ZKey.nullish().transform((cell) => cell ?? null),
  questions: z
    .array(z.unknown())
    .max(SURVEY_IMPORT_PLAN_MAX_ENTRIES)
    .nullish()
    .transform((questions) => questions ?? []),
  skipped: z
    .array(z.unknown())
    .max(SURVEY_IMPORT_PLAN_MAX_ENTRIES)
    .nullish()
    .transform((skipped) => skipped ?? []),
});

export const ZDocumentPlanRule = z.object({
  kind: z.enum(DOCUMENT_PLAN_RULE_KINDS),
  question: ZLabel,
  operator: z.enum(DOCUMENT_PLAN_OPERATORS),
  // `isSubmitted` and `isSkipped` take none, which a JSON-mode provider may send as `null`.
  values: z
    .array(ZLabel)
    .max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_OPTIONS)
    .nullish()
    .transform((values) => values ?? []),
  target: ZLabel.nullable(),
});

export const ZDocumentPlanEntry = z.object({
  ref: ZKey,
  kind: z.string().max(SURVEY_IMPORT_PLAN_MAX_TYPE_CHARS),
  idCell: ZKey.nullable(),
  sectionCell: ZKey.nullable(),
  required: z.boolean(),
  headline: ZPieces.nullish().transform((pieces) => pieces ?? []),
  subheader: ZPieces.nullish().transform((pieces) => pieces ?? []),
  options: z
    .array(ZOption)
    .max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_OPTIONS)
    .nullish()
    .transform((options) => options ?? []),
  columns: z
    .array(ZOption)
    .max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_OPTIONS)
    .nullish()
    .transform((columns) => columns ?? []),
  lowerLabel: ZPieces.nullish().transform((pieces) => pieces ?? []),
  upperLabel: ZPieces.nullish().transform((pieces) => pieces ?? []),
  dropdown: z.boolean(),
  inputType: z.enum(DOCUMENT_PLAN_INPUT_TYPES).nullable(),
  scale: z.enum(DOCUMENT_PLAN_SCALES).nullable(),
  range: z
    .union([z.enum(DOCUMENT_PLAN_RANGES), z.number().int()])
    .nullable()
    .transform((range) => (range === null ? null : String(range))),
  format: z.enum(DOCUMENT_PLAN_DATE_FORMATS).nullable(),
  rules: z
    .array(ZDocumentPlanRule)
    .max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_RULES)
    .nullish()
    .transform((rules) => rules ?? []),
  logicNotes: z
    .array(z.string().max(SURVEY_IMPORT_PLAN_MAX_RAW_NOTE_CHARS))
    .max(SURVEY_IMPORT_DOCUMENT_PLAN_MAX_RULES)
    .nullish()
    .transform((notes) => notes ?? []),
});

export const ZDocumentPlanSkip = z.object({
  ref: ZKey,
  reason: z.string().max(SURVEY_IMPORT_PLAN_MAX_RAW_NOTE_CHARS),
});

export type TDocumentPlanPiece = z.infer<typeof ZPiece>;
export type TDocumentPlanOption = z.infer<typeof ZOption>;
export type TDocumentPlanRule = z.infer<typeof ZDocumentPlanRule>;
export type TDocumentPlanEntry = z.infer<typeof ZDocumentPlanEntry>;
