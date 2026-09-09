import { z } from "zod";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { ZUserLocale } from "@formbricks/types/user";
import {
  GENERATED_SURVEY_ELEMENT_TYPES,
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_CHOICES,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  GENERATED_SURVEY_MIN_BLOCKS,
  GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK,
  IMPORT_ADDRESS_FIELDS,
  IMPORT_CONTACT_INFO_FIELDS,
  V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH,
  V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH,
} from "./constants";

export const V3_SURVEY_GENERATE_ALLOWED_LOCALES = ZUserLocale.options;
export const ZV3SurveyGenerateAllowedLocale = z.enum(V3_SURVEY_GENERATE_ALLOWED_LOCALES);
export type TV3SurveyGenerateAllowedLocale = z.infer<typeof ZV3SurveyGenerateAllowedLocale>;

const ALLOWED_GENERATE_LOCALE_LOOKUP = new Map<string, TV3SurveyGenerateAllowedLocale>(
  V3_SURVEY_GENERATE_ALLOWED_LOCALES.map((locale) => [locale.toLowerCase(), locale] as const)
);

export function normalizeV3SurveyGenerateLocale(value: string): TV3SurveyGenerateAllowedLocale | null {
  const normalizedLanguage = normalizeLanguageCode(value);

  if (!normalizedLanguage) {
    return null;
  }

  return ALLOWED_GENERATE_LOCALE_LOOKUP.get(normalizedLanguage.toLowerCase()) ?? null;
}

const ZV3SurveyGenerateLanguage = z
  .string()
  .trim()
  .min(1, "Language code is required")
  .transform((value, ctx) => {
    const normalizedLanguage = normalizeV3SurveyGenerateLocale(value);

    if (!normalizedLanguage) {
      ctx.addIssue({
        code: "custom",
        message: `Language '${value}' is not supported for AI survey creation`,
      });
      return z.NEVER;
    }

    return normalizedLanguage;
  });

export const ZV3SurveyGenerateBody = z
  .object({
    workspaceId: z.cuid2(),
    prompt: z
      .string()
      .trim()
      .min(
        V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH,
        `Prompt must be at least ${V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH} characters`
      )
      .max(
        V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH,
        `Prompt must be ${V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH} characters or less`
      ),
    type: z.enum(["link", "app"]).prefault("link"),
    language: ZV3SurveyGenerateLanguage.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------------------------------
// Draft schema factory (D2). Create with AI instantiates it with plain strings; the import lane with
// localized text arrays and its own limits, languages and element types. The default instantiation is
// byte-identical to the schema Create with AI shipped with (see schema-snapshot.test.ts).
// ---------------------------------------------------------------------------------------------------

export const GENERATED_TEXT_MAX_LENGTH = 220;
export const GENERATED_DESCRIPTION_MAX_LENGTH = 320;
export const GENERATED_CHOICE_MAX_LENGTH = 80;

const ZGeneratedText = z.string().trim().min(1).max(GENERATED_TEXT_MAX_LENGTH);
const ZGeneratedDescription = z.string().trim().min(1).max(GENERATED_DESCRIPTION_MAX_LENGTH);
const ZGeneratedChoice = z.string().trim().min(1).max(GENERATED_CHOICE_MAX_LENGTH);
const ZGeneratedRatingRangeForAI = z.enum(["5", "7", "10"]);
const ZGeneratedRatingRange = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  ZGeneratedRatingRangeForAI.transform((value) => Number(value) as 5 | 7 | 10)
);

/**
 * `[{ languageCode, text }]`, one entry per language, the enum built per call from the detected codes
 * so the model cannot invent a third language (D2). Never `V3_SURVEY_GENERATE_ALLOWED_LOCALES`.
 *
 * Deliberately no `.min(1)`: models answer "no text here" with `[]` (a later chunk has no survey name,
 * a question has no subheader), and the SDK validates the whole object against this schema — a
 * minimum would turn that into a failed chunk. The finalizer decides what an empty text means.
 */
export function createLocalizedText(languageCodes: readonly [string, ...string[]], maxLength: number) {
  return z.array(
    z
      .object({
        languageCode: z.enum(languageCodes),
        text: z.string().trim().min(1).max(maxLength),
      })
      .strict()
  );
}

export type TGeneratedLocalizedText = { languageCode: string; text: string }[];
export type TGeneratedDraftText = string | TGeneratedLocalizedText;

export type TGeneratedSurveyDraftLimits = {
  maxBlocks: number;
  maxQuestionsPerBlock: number;
  maxChoices: number;
};

export const DEFAULT_GENERATED_SURVEY_DRAFT_LIMITS: TGeneratedSurveyDraftLimits = {
  maxBlocks: GENERATED_SURVEY_MAX_BLOCKS,
  maxQuestionsPerBlock: GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  maxChoices: GENERATED_SURVEY_MAX_CHOICES,
};

export type TGeneratedSurveyDraftSchemaOptions<
  TText extends z.ZodTypeAny = typeof ZGeneratedText,
  TDescription extends z.ZodTypeAny = typeof ZGeneratedDescription,
  TChoice extends z.ZodTypeAny = typeof ZGeneratedChoice,
> = {
  /** Schema for a headline-sized text. Default: a plain string. */
  text?: TText;
  /** Schema for a description-sized text. Default: a plain string. */
  description?: TDescription;
  /** Schema for a choice label. Default: a plain string. */
  choice?: TChoice;
  limits?: Partial<TGeneratedSurveyDraftLimits>;
  elementTypes?: readonly [string, ...string[]];
  /**
   * Import only: the language codes the draft may use. Adds `defaultLanguage`, restricts `language` to
   * these codes and unlocks the import-only element fields. Absent for Create with AI.
   */
  languageCodes?: readonly [string, ...string[]];
};

function validateGeneratedSurveyElement(
  element: {
    type: string;
    choices: unknown[] | null;
    rows?: unknown[] | null;
    columns?: unknown[] | null;
    range?: string | number | null;
  },
  ctx: z.RefinementCtx
): void {
  if (
    (element.type === "multipleChoiceSingle" ||
      element.type === "multipleChoiceMulti" ||
      element.type === "ranking") &&
    !element.choices
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["choices"],
      message: "Choice questions must include choices",
    });
  }

  if (element.type === "matrix") {
    if (!element.rows) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Matrix questions must include rows",
      });
    }

    if (!element.columns) {
      ctx.addIssue({
        code: "custom",
        path: ["columns"],
        message: "Matrix questions must include columns",
      });
    }
  }

  if (element.type === "csat" && element.range !== "5" && element.range !== 5) {
    ctx.addIssue({
      code: "custom",
      path: ["range"],
      message: "CSAT questions must use a range of 5",
    });
  }

  if (
    element.type === "ces" &&
    element.range !== "5" &&
    element.range !== 5 &&
    element.range !== "7" &&
    element.range !== 7
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["range"],
      message: "CES questions must use a range of 5 or 7",
    });
  }
}

export function createGeneratedSurveyDraftSchema<
  TText extends z.ZodTypeAny = typeof ZGeneratedText,
  TDescription extends z.ZodTypeAny = typeof ZGeneratedDescription,
  TChoice extends z.ZodTypeAny = typeof ZGeneratedChoice,
>(options: TGeneratedSurveyDraftSchemaOptions<TText, TDescription, TChoice> = {}) {
  // The defaults are the generic defaults, so the casts only apply when a caller omitted the option.
  const text = (options.text ?? ZGeneratedText) as TText;
  const description = (options.description ?? ZGeneratedDescription) as TDescription;
  const choice = (options.choice ?? ZGeneratedChoice) as TChoice;
  const limits = { ...DEFAULT_GENERATED_SURVEY_DRAFT_LIMITS, ...options.limits };
  const elementTypes = options.elementTypes ?? GENERATED_SURVEY_ELEMENT_TYPES;
  const isImport = options.languageCodes !== undefined;
  const choiceList = z.array(choice).min(2).max(limits.maxChoices);

  const importElementFields = {
    /** cta: the button text; consent: the checkbox label. */
    buttonLabel: text.nullable().optional(),
    /** cta only. The resolver's external-URL check applies on import. */
    buttonUrl: z.string().trim().url().nullable().optional(),
    /** consent: the statement the respondent agrees to. */
    label: description.nullable().optional(),
    /** address / contactInfo: which sub-fields to show. */
    fields: z
      .array(z.enum([...IMPORT_ADDRESS_FIELDS, ...IMPORT_CONTACT_INFO_FIELDS] as [string, ...string[]]))
      .nullable()
      .optional(),
    /** Choice questions: the source offered "Other (please specify)"; becomes the `other` choice, not a label. */
    allowOther: z.boolean().nullable().optional(),
    /** Single choice shown as a dropdown / select list in the source. */
    dropdown: z.boolean().nullable().optional(),
    /** The wording of that "Other" option when the source has one. */
    otherLabel: choice.nullable().optional(),
    /** The source's original type name when it was approximated, or anything worth reporting. */
    notes: z.array(z.string().trim().min(1).max(200)).nullable().optional(),
  };

  // Key order is part of the provider-facing schema; the import-only fields come last.
  const elementShape = {
    type: z.enum(elementTypes),
    headline: text,
    subheader: description.nullable(),
    required: z.boolean(),
    placeholder: z.string().trim().min(1).max(120).nullable(),
    longAnswer: z.boolean().nullable(),
    choices: choiceList.nullable(),
    rows: choiceList.nullable().optional(),
    columns: choiceList.nullable().optional(),
    lowerLabel: z.string().trim().min(1).max(60).nullable(),
    upperLabel: z.string().trim().min(1).max(60).nullable(),
    scale: z.enum(["number", "smiley", "star"]).nullable(),
    format: z.enum(["M-d-y", "d-M-y", "y-M-d"]).nullable().optional(),
    // Absent at runtime for Create with AI (strict mode rejects them); typed as optional either way so the
    // output type of both variants is one structural shape.
    ...((isImport ? importElementFields : {}) as typeof importElementFields),
  };

  // Import: the provider-facing schema stays structural. The cross-field rules (choices for choice
  // questions, rows and columns for a matrix, csat/ces ranges) are repaired by the import finalizer with a
  // report line each, because the SDK rejects the whole chunk on the first violation — a picture-choice
  // row without labels used to take 16 other questions down with it. The internal schema keeps the rules.
  const elementForAIShape = z
    .object({ ...elementShape, range: ZGeneratedRatingRangeForAI.nullable() })
    .strict();
  const elementForAI = isImport
    ? elementForAIShape
    : elementForAIShape.superRefine(validateGeneratedSurveyElement);
  const elementInternal = z
    .object({ ...elementShape, range: ZGeneratedRatingRange.nullable() })
    .strict()
    .superRefine(validateGeneratedSurveyElement);

  // Import: a chunk may legitimately hold no questions (a title page) and the finalizer drops empty
  // blocks; the SDK would otherwise reject the object before our code sees it.
  const minQuestionsPerBlock = isImport ? 0 : GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK;
  const blockOf = <TElement extends z.ZodTypeAny>(element: TElement) =>
    z
      .object({
        name: text,
        questions: z.array(element).min(minQuestionsPerBlock).max(limits.maxQuestionsPerBlock),
      })
      .strict();

  const languageSchema = options.languageCodes
    ? z.enum(options.languageCodes)
    : ZV3SurveyGenerateAllowedLocale;

  // Required at runtime for imports, absent for Create with AI; typed optional so both variants share one
  // output shape (same idea as importElementFields above).
  const defaultLanguageField = (options.languageCodes
    ? { defaultLanguage: z.enum(options.languageCodes) }
    : {}) as unknown as { defaultLanguage: z.ZodOptional<z.ZodEnum<Record<string, string>>> };
  const rootNotesField = (
    isImport ? { notes: z.array(z.string().trim().min(1).max(300)).nullable().optional() } : {}
  ) as { notes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>> };

  const draftShape = {
    language: languageSchema,
    ...defaultLanguageField,
    name: text,
    description: description.nullable(),
    welcomeCard: z
      .object({
        enabled: z.boolean(),
        headline: text.nullable(),
        subheader: description.nullable(),
        buttonLabel: text.nullable(),
      })
      .strict()
      .nullable(),
    ending: z
      .object({
        headline: text.nullable(),
        subheader: description.nullable(),
      })
      .strict()
      .nullable(),
    ...rootNotesField,
  };

  const blocksOf = <TElement extends z.ZodTypeAny>(element: TElement) =>
    z
      .array(blockOf(element))
      .min(isImport ? 0 : GENERATED_SURVEY_MIN_BLOCKS)
      .max(limits.maxBlocks);

  return {
    /** Handed to the provider: string ranges, no `z.preprocess` (it does not survive JSON-Schema conversion). */
    forAI: z.object({ ...draftShape, blocks: blocksOf(elementForAI) }).strict(),
    /** Used after the fact: ranges coerced to numbers. */
    internal: z.object({ ...draftShape, blocks: blocksOf(elementInternal) }).strict(),
    limits,
    elementTypes,
  };
}

const defaultDraftSchema = createGeneratedSurveyDraftSchema();

export const ZGeneratedSurveyDraftForAI = defaultDraftSchema.forAI;
export const ZGeneratedSurveyDraft = defaultDraftSchema.internal;

export type TV3SurveyGenerateBody = z.infer<typeof ZV3SurveyGenerateBody>;
export type TGeneratedSurveyDraft = z.infer<typeof ZGeneratedSurveyDraft>;
export type TGeneratedSurveyElement = z.infer<
  typeof ZGeneratedSurveyDraft
>["blocks"][number]["questions"][number];

/**
 * Structural type every instantiation of the draft satisfies once parsed: texts may be strings or
 * localized arrays, ranges are numbers, and the import-only fields are optional.
 */
export type TGeneratedDraftElementLike = {
  type: string;
  headline: TGeneratedDraftText;
  subheader?: TGeneratedDraftText | null;
  required: boolean;
  placeholder?: string | null;
  longAnswer?: boolean | null;
  choices?: TGeneratedDraftText[] | null;
  rows?: TGeneratedDraftText[] | null;
  columns?: TGeneratedDraftText[] | null;
  lowerLabel?: string | null;
  upperLabel?: string | null;
  scale?: "number" | "smiley" | "star" | null;
  format?: "M-d-y" | "d-M-y" | "y-M-d" | null;
  range?: 5 | 7 | 10 | null;
  buttonLabel?: TGeneratedDraftText | null;
  buttonUrl?: string | null;
  label?: TGeneratedDraftText | null;
  fields?: string[] | null;
  allowOther?: boolean | null;
  otherLabel?: TGeneratedDraftText | null;
  dropdown?: boolean | null;
  notes?: string[] | null;
};

export type TGeneratedDraftLike = {
  language: string;
  defaultLanguage?: string;
  name: TGeneratedDraftText;
  description?: TGeneratedDraftText | null;
  welcomeCard?: {
    enabled: boolean;
    headline?: TGeneratedDraftText | null;
    subheader?: TGeneratedDraftText | null;
    buttonLabel?: TGeneratedDraftText | null;
  } | null;
  ending?: { headline?: TGeneratedDraftText | null; subheader?: TGeneratedDraftText | null } | null;
  blocks: { name: TGeneratedDraftText; questions: TGeneratedDraftElementLike[] }[];
  notes?: string[] | null;
};
