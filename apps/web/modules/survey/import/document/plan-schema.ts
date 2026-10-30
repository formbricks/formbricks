import { z } from "zod";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";

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
    .describe(
      "null for the whole cell; else the exact part of the cell this text is, copied character for character"
    ),
});

const ZOptionForAI = z.object({
  code: z
    .string()
    .nullable()
    .describe('The code the file gives the option ("1" in "1 = Yes"), copied exactly, or null'),
  isOther: z.boolean().describe('Whether the option is an "Other" that asks the respondent to say what'),
  texts: z.array(ZPieceForAI).describe("The option's text, one piece per language"),
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
    .describe("The answers compared with: option codes or option texts as the file writes them, or numbers"),
  target: z
    .string()
    .nullable()
    .describe('skipTo only: the question jumped to, by ID or line key, or "end"; null for showIf'),
});

/**
 * What the provider is asked for. String enums only, no preprocess or transforms: those do not survive
 * the JSON-schema conversion structured output goes through.
 */
export const ZDocumentImportPlanForAI = z.object({
  defaultLanguage: z.string().describe("The BCP-47 code of the file's main language, e.g. en-US"),
  languages: z.array(z.string()).describe("Every language the file's texts are in, default first"),
  titleCell: z.string().nullable().describe("The key of the cell holding the survey's title, or null"),
  questions: z
    .array(
      z.object({
        ref: z.string().describe("The key of the line the entry starts on, e.g. R5"),
        kind: z.enum(DOCUMENT_PLAN_KINDS),
        idCell: z.string().nullable().describe("The key of the cell holding the question's ID or number"),
        sectionCell: z
          .string()
          .nullable()
          .describe("The key of the cell naming the section or block the question is in"),
        required: z.boolean(),
        headline: z.array(ZPieceForAI).describe("The question's text, one piece per language"),
        subheader: z.array(ZPieceForAI).describe("A description under the question, one piece per language"),
        options: z.array(ZOptionForAI).describe("Choices, ranking items or matrix rows"),
        columns: z.array(ZOptionForAI).describe("A matrix's columns"),
        lowerLabel: z.array(ZPieceForAI).describe("A scale's low-end label, one piece per language"),
        upperLabel: z.array(ZPieceForAI).describe("A scale's high-end label, one piece per language"),
        dropdown: z.boolean().describe("Whether the file says the choices show as a dropdown"),
        inputType: z.enum(DOCUMENT_PLAN_INPUT_TYPES).nullable(),
        scale: z.enum(DOCUMENT_PLAN_SCALES).nullable(),
        range: z.enum(DOCUMENT_PLAN_RANGES).nullable(),
        format: z.enum(DOCUMENT_PLAN_DATE_FORMATS).nullable(),
        rules: z.array(ZRuleForAI),
        logicNotes: z.array(z.string()).describe("One sentence per rule, in the file's language"),
      })
    )
    .describe("Every question, and the welcome and closing texts, that start on the lines asked about"),
  skipped: z
    .array(z.object({ ref: z.string(), reason: z.string().describe("Why, in one short sentence") }))
    .describe("Questions on the lines asked about that Formbricks cannot represent"),
});

/** Bounds on what comes back, so a hostile or broken response costs a bounded amount to check. */
const MAX_PLAN_ENTRIES = 1_000;
const MAX_PIECES = 60;
const MAX_OPTIONS = 400;
const MAX_RULES = 20;
const MAX_RAW_NOTE_CHARS = 4_000;
/** A piece quotes at most a cell, which the reader caps at 32,767 characters. */
const MAX_PIECE_CHARS = 32_767;
const ZKey = z.string().max(20);
const ZLabel = z.string().max(200);

const ZPiece = z.object({
  language: z.string().max(64),
  cell: ZKey,
  text: z.string().max(MAX_PIECE_CHARS).nullable(),
});
const ZPieces = z.array(ZPiece).max(MAX_PIECES);
const ZOption = z.object({ code: ZLabel.nullable(), isOther: z.boolean(), texts: ZPieces });

/**
 * What a returned plan is checked against. Lenient where the checks are stricter: `kind` is any short
 * string here, and `plan-checks.ts` holds the allowlist, so it is enforced on every path — including a
 * provider without structured output, or a response that skipped schema validation.
 */
export const ZDocumentImportPlanEnvelope = z.object({
  defaultLanguage: z.string().max(64),
  languages: z.array(z.string().max(64)).max(MAX_PIECES),
  titleCell: ZKey.nullable(),
  questions: z.array(z.unknown()).max(MAX_PLAN_ENTRIES),
  skipped: z.array(z.unknown()).max(MAX_PLAN_ENTRIES),
});

export const ZDocumentPlanRule = z.object({
  kind: z.enum(DOCUMENT_PLAN_RULE_KINDS),
  question: ZLabel,
  operator: z.enum(DOCUMENT_PLAN_OPERATORS),
  values: z.array(ZLabel).max(MAX_OPTIONS),
  target: ZLabel.nullable(),
});

export const ZDocumentPlanEntry = z.object({
  ref: ZKey,
  kind: z.string().max(40),
  idCell: ZKey.nullable(),
  sectionCell: ZKey.nullable(),
  required: z.boolean(),
  headline: ZPieces,
  subheader: ZPieces,
  options: z.array(ZOption).max(MAX_OPTIONS),
  columns: z.array(ZOption).max(MAX_OPTIONS),
  lowerLabel: ZPieces,
  upperLabel: ZPieces,
  dropdown: z.boolean(),
  inputType: z.enum(DOCUMENT_PLAN_INPUT_TYPES).nullable(),
  scale: z.enum(DOCUMENT_PLAN_SCALES).nullable(),
  range: z.enum(DOCUMENT_PLAN_RANGES).nullable(),
  format: z.enum(DOCUMENT_PLAN_DATE_FORMATS).nullable(),
  rules: z.array(ZDocumentPlanRule).max(MAX_RULES),
  logicNotes: z.array(z.string().max(MAX_RAW_NOTE_CHARS)).max(MAX_RULES),
});

export const ZDocumentPlanSkip = z.object({
  ref: ZKey,
  reason: z.string().max(MAX_RAW_NOTE_CHARS),
});

export type TDocumentPlanPiece = z.infer<typeof ZPiece>;
export type TDocumentPlanOption = z.infer<typeof ZOption>;
export type TDocumentPlanRule = z.infer<typeof ZDocumentPlanRule>;
export type TDocumentPlanEntry = z.infer<typeof ZDocumentPlanEntry>;
