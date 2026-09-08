import "server-only";
import { createId } from "@paralleldrive/cuid2";
import type { z } from "zod";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import { type TV3SurveyPrepareResult, prepareV3SurveyCreateInput } from "../prepare";
import { DEFAULT_V3_SURVEY_LANGUAGE, type TV3CreateSurveyBody, formatV3ZodInvalidParams } from "../schemas";
import {
  IMPORT_ADDRESS_FIELDS,
  IMPORT_CONTACT_INFO_FIELDS,
  V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH,
  V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS,
} from "./constants";
import { buildV3SurveyGenerationPrompt, buildV3SurveyGenerationSystemPrompt } from "./prompt";
import {
  type TGeneratedDraftElementLike,
  type TGeneratedDraftLike,
  type TGeneratedDraftText,
  type TV3SurveyGenerateBody,
  V3_SURVEY_GENERATE_ALLOWED_LOCALES,
  ZGeneratedSurveyDraft,
  ZGeneratedSurveyDraftForAI,
} from "./schemas";

export type TV3SurveyGenerateValidation = {
  valid: boolean;
  invalid_params: InvalidParam[];
  languages: Array<{ code: string; default: boolean; enabled: boolean }>;
};

/** A translation the adapter had to fill from the default language (D2 completeness rule). */
export type TV3SurveyTranslationFill = { path: string; languageCode: string };

export type TV3SurveyGenerateResult = {
  language: string;
  payload: TV3CreateSurveyBody;
  validation: TV3SurveyGenerateValidation;
  /** Empty for Create with AI; the import lane turns these into `translation_filled` warnings. */
  translationFills: TV3SurveyTranslationFill[];
};

const V3_SURVEY_GENERATION_TIMEOUT_MS = 45_000;

// Gemini 2.5 Flash spends a large share of the output budget on reasoning tokens before emitting
// the survey JSON; 8192 leaves headroom for both so long prompts don't stop with finishReason
// "length" (the previous 3000 budget did).
const V3_SURVEY_GENERATION_MAX_OUTPUT_TOKENS = 8192;

export class V3SurveyGeneratePromptError extends Error {
  invalidParams: InvalidParam[];

  constructor(invalidParams: InvalidParam[]) {
    super("Prompt needs more detail");
    this.name = "V3SurveyGeneratePromptError";
    this.invalidParams = invalidParams;
  }
}

export class V3SurveyGeneratedPayloadValidationError extends Error {
  invalidParams: InvalidParam[];

  constructor(invalidParams: InvalidParam[]) {
    super(
      invalidParams.length > 0
        ? `Generated survey payload is invalid: ${invalidParams
            .map((param) => `${param.name}: ${param.reason}`)
            .join("; ")}`
        : "Generated survey payload is invalid"
    );
    this.name = "V3SurveyGeneratedPayloadValidationError";
    this.invalidParams = invalidParams;
  }
}

/**
 * Turns a draft text (a string, or `[{ languageCode, text }]` for imports) into the public locale map
 * the create payload carries. `path` names the field for the completeness warnings.
 */
export type TDraftTextResolver = (value: TGeneratedDraftText, path: string) => Record<string, string>;

export type TDraftLanguages = {
  defaultLanguage: string;
  /** Every language the survey declares, default included, as canonical BCP-47 tags. */
  codes: string[];
};

/** Create with AI: one language, the text as it came. */
function createSingleLanguageResolver(language: string): TDraftTextResolver {
  return (value) => ({ [language]: (typeof value === "string" ? value : (value[0]?.text ?? "")).trim() });
}

/**
 * Import: every declared language gets an entry. A text missing one of them is filled from the default
 * language and recorded, because v3 rejects `missing_translation` and the adapter must never fail.
 */
export function createMultilingualResolver(
  languages: TDraftLanguages,
  fills: TV3SurveyTranslationFill[]
): TDraftTextResolver {
  const canonical = (code: string) => normalizeLanguageCode(code) ?? code;
  const defaultCode = canonical(languages.defaultLanguage);
  const codes = Array.from(new Set([defaultCode, ...languages.codes.map(canonical)]));

  return (value, path) => {
    // A plain string here is one of the adapter's own fallbacks ("Start", "Thanks for your feedback"):
    // it is not a missing translation, so it fans out to every language without a fill.
    if (typeof value === "string") {
      return Object.fromEntries(codes.map((code) => [code, value.trim()]));
    }

    const entries = value;
    const byCode = new Map<string, string>();
    for (const entry of entries) {
      const code = canonical(entry.languageCode);
      if (!byCode.has(code)) byCode.set(code, entry.text.trim());
    }

    const defaultText = byCode.get(defaultCode) ?? entries[0]?.text.trim() ?? "";
    const map: Record<string, string> = {};
    for (const code of codes) {
      const text = byCode.get(code);
      if (text === undefined || text.length === 0) {
        map[code] = defaultText;
        if (code !== defaultCode || byCode.get(defaultCode) === undefined) {
          fills.push({ path, languageCode: code });
        }
      } else {
        map[code] = text;
      }
    }
    return map;
  };
}

function firstText(value: TGeneratedDraftText | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : (value[0]?.text ?? "");
}

function getPromptInvalidParams(prompt: string): InvalidParam[] {
  const normalizedPrompt = prompt.trim();
  const wordCount = normalizedPrompt.split(/\s+/).filter(Boolean).length;

  if (
    normalizedPrompt.length >= V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH &&
    wordCount >= V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS
  ) {
    return [];
  }

  return [
    {
      name: "prompt",
      reason:
        "Describe the survey goal, audience, or topic in a sentence so the AI can create a useful draft.",
    },
  ];
}

type TBuildContext = { resolve: TDraftTextResolver; defaultLanguage: string };

function createLabeledItem(
  prefix: string,
  label: TGeneratedDraftText,
  index: number,
  ctx: TBuildContext,
  path: string
): { id: string; label: Record<string, string> } {
  return {
    id: `${prefix}_${index + 1}`,
    label: ctx.resolve(label, `${path}.${index}`),
  };
}

function translatedField<TName extends string>(
  name: TName,
  value: TGeneratedDraftText | null | undefined,
  ctx: TBuildContext,
  path: string
): Partial<Record<TName, Record<string, string>>> {
  if (!value || (typeof value !== "string" && value.length === 0)) {
    return {};
  }

  return { [name]: ctx.resolve(value, path) } as Record<TName, Record<string, string>>;
}

function buildBaseElement(element: TGeneratedDraftElementLike, index: number, ctx: TBuildContext) {
  const path = `blocks.elements.${index}`;
  return {
    id: `q_${index + 1}_${createId().slice(0, 8)}`,
    headline: ctx.resolve(element.headline, `${path}.headline`),
    ...translatedField("subheader", element.subheader, ctx, `${path}.subheader`),
    required: element.required,
    isDraft: true,
  };
}

type TBaseElement = ReturnType<typeof buildBaseElement>;

function buildOpenTextElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: "openText" as const,
    ...translatedField("placeholder", element.placeholder, ctx, `${baseElement.id}.placeholder`),
    longAnswer: element.longAnswer ?? false,
    inputType: "text" as const,
    charLimit: { enabled: false },
  };
}

function buildChoiceElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: element.type as "multipleChoiceSingle" | "multipleChoiceMulti",
    choices: (element.choices ?? []).map((choice, choiceIndex) =>
      createLabeledItem("choice", choice, choiceIndex, ctx, `${baseElement.id}.choices`)
    ),
    shuffleOption: "none" as const,
    displayType: "list" as const,
  };
}

function buildRankingElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: "ranking" as const,
    choices: (element.choices ?? []).map((choice, choiceIndex) =>
      createLabeledItem("choice", choice, choiceIndex, ctx, `${baseElement.id}.choices`)
    ),
    shuffleOption: "none" as const,
  };
}

function buildMatrixElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: "matrix" as const,
    rows: (element.rows ?? []).map((row, rowIndex) =>
      createLabeledItem("row", row, rowIndex, ctx, `${baseElement.id}.rows`)
    ),
    columns: (element.columns ?? []).map((column, columnIndex) =>
      createLabeledItem("column", column, columnIndex, ctx, `${baseElement.id}.columns`)
    ),
    shuffleOption: "none" as const,
  };
}

function buildScaleLabels(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...translatedField("lowerLabel", element.lowerLabel, ctx, `${baseElement.id}.lowerLabel`),
    ...translatedField("upperLabel", element.upperLabel, ctx, `${baseElement.id}.upperLabel`),
  };
}

function getSatisfactionQuestionRange(element: TGeneratedDraftElementLike): 5 | 7 | 10 {
  if (element.range) {
    return element.range;
  }

  if (element.type === "ces") {
    return 7;
  }

  return 5;
}

function buildNpsElement(baseElement: TBaseElement, element: TGeneratedDraftElementLike, ctx: TBuildContext) {
  return {
    ...baseElement,
    type: "nps" as const,
    ...buildScaleLabels(baseElement, element, ctx),
    isColorCodingEnabled: false,
  };
}

function buildSatisfactionElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: element.type as "csat" | "ces",
    scale: element.scale ?? "number",
    range: getSatisfactionQuestionRange(element),
    ...buildScaleLabels(baseElement, element, ctx),
    isColorCodingEnabled: false,
  };
}

function buildRatingElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: "rating" as const,
    scale: element.scale ?? "number",
    range: element.range ?? 5,
    ...buildScaleLabels(baseElement, element, ctx),
    isColorCodingEnabled: false,
  };
}

// --- Import-only element types (D2 refinements, decided 2026-09-08) ---

function buildCtaElement(baseElement: TBaseElement, element: TGeneratedDraftElementLike, ctx: TBuildContext) {
  const hasUrl = typeof element.buttonUrl === "string" && element.buttonUrl.length > 0;
  return {
    ...baseElement,
    type: "cta" as const,
    buttonExternal: hasUrl,
    ...(hasUrl ? { buttonUrl: element.buttonUrl } : {}),
    ctaButtonLabel: ctx.resolve(element.buttonLabel ?? "Next", `${baseElement.id}.ctaButtonLabel`),
  };
}

function buildConsentElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: "consent" as const,
    label: ctx.resolve(element.label ?? element.buttonLabel ?? "I agree", `${baseElement.id}.label`),
  };
}

function buildToggleInputs(
  fieldNames: readonly string[],
  shown: readonly string[] | null | undefined,
  required: boolean,
  ctx: TBuildContext,
  path: string,
  placeholders: Record<string, string>
) {
  const visible = new Set(shown && shown.length > 0 ? shown : fieldNames);
  return Object.fromEntries(
    fieldNames.map((field) => [
      field,
      {
        show: visible.has(field),
        required: required && visible.has(field),
        placeholder: ctx.resolve(placeholders[field] ?? field, `${path}.${field}.placeholder`),
      },
    ])
  );
}

const ADDRESS_PLACEHOLDERS: Record<string, string> = {
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "City",
  state: "State",
  zip: "ZIP",
  country: "Country",
};

const CONTACT_INFO_PLACEHOLDERS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  company: "Company",
};

function buildAddressElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: "address" as const,
    ...buildToggleInputs(
      IMPORT_ADDRESS_FIELDS,
      element.fields,
      element.required,
      ctx,
      baseElement.id,
      ADDRESS_PLACEHOLDERS
    ),
  };
}

function buildContactInfoElement(
  baseElement: TBaseElement,
  element: TGeneratedDraftElementLike,
  ctx: TBuildContext
) {
  return {
    ...baseElement,
    type: "contactInfo" as const,
    ...buildToggleInputs(
      IMPORT_CONTACT_INFO_FIELDS,
      element.fields,
      element.required,
      ctx,
      baseElement.id,
      CONTACT_INFO_PLACEHOLDERS
    ),
  };
}

function buildElement(element: TGeneratedDraftElementLike, index: number, ctx: TBuildContext) {
  const baseElement = buildBaseElement(element, index, ctx);

  switch (element.type) {
    case "openText":
      return buildOpenTextElement(baseElement, element, ctx);
    case "multipleChoiceSingle":
    case "multipleChoiceMulti":
      return buildChoiceElement(baseElement, element, ctx);
    case "ranking":
      return buildRankingElement(baseElement, element, ctx);
    case "matrix":
      return buildMatrixElement(baseElement, element, ctx);
    case "date":
      return { ...baseElement, type: "date" as const, format: element.format ?? "M-d-y" };
    case "nps":
      return buildNpsElement(baseElement, element, ctx);
    case "csat":
    case "ces":
      return buildSatisfactionElement(baseElement, element, ctx);
    case "cta":
      return buildCtaElement(baseElement, element, ctx);
    case "consent":
      return buildConsentElement(baseElement, element, ctx);
    case "address":
      return buildAddressElement(baseElement, element, ctx);
    case "contactInfo":
      return buildContactInfoElement(baseElement, element, ctx);
    default:
      return buildRatingElement(baseElement, element, ctx);
  }
}

const RATING_LIKE_GENERATED_ELEMENT_TYPES = new Set<string>([
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.Matrix,
  TSurveyElementTypeEnum.Ranking,
]);

function isRatingLikeGeneratedElement(element: TGeneratedDraftElementLike): boolean {
  return RATING_LIKE_GENERATED_ELEMENT_TYPES.has(element.type);
}

/** Rating-like questions render alone; split mixed blocks so each such question gets its own block. */
export function normalizeGeneratedSurveyBlocks<TDraft extends TGeneratedDraftLike>(
  generatedSurvey: TDraft
): TDraft {
  return {
    ...generatedSurvey,
    blocks: generatedSurvey.blocks.flatMap((block) => {
      if (block.questions.length === 1) {
        return [block];
      }

      const normalizedBlocks: TGeneratedDraftLike["blocks"] = [];
      let pendingNonRatingQuestions: TGeneratedDraftElementLike[] = [];

      const flushPendingNonRatingQuestions = () => {
        if (pendingNonRatingQuestions.length === 0) {
          return;
        }

        normalizedBlocks.push({
          name: block.name,
          questions: pendingNonRatingQuestions,
        });
        pendingNonRatingQuestions = [];
      };

      block.questions.forEach((question) => {
        if (!isRatingLikeGeneratedElement(question)) {
          pendingNonRatingQuestions.push(question);
          return;
        }

        flushPendingNonRatingQuestions();
        normalizedBlocks.push({
          name: question.headline,
          questions: [question],
        });
      });

      flushPendingNonRatingQuestions();

      return normalizedBlocks;
    }),
  };
}

type TBuildCreatePayloadInput = Pick<TV3SurveyGenerateBody, "workspaceId" | "type">;

function buildCreatePayload(
  input: TBuildCreatePayloadInput,
  generatedSurvey: TGeneratedDraftLike,
  languages: TDraftLanguages,
  ctx: TBuildContext
): unknown {
  const welcomeCard = generatedSurvey.welcomeCard;
  const welcomeHeadline = welcomeCard?.headline ?? generatedSurvey.name;
  let questionIndex = 0;

  return {
    workspaceId: input.workspaceId,
    type: input.type,
    name: firstText(generatedSurvey.name),
    status: "draft",
    defaultLanguage: languages.defaultLanguage,
    languages: languages.codes.map((code) => ({
      code,
      default: code === languages.defaultLanguage,
      enabled: true,
    })),
    metadata: {
      title: ctx.resolve(generatedSurvey.name, "metadata.title"),
      ...(generatedSurvey.description
        ? { description: ctx.resolve(generatedSurvey.description, "metadata.description") }
        : {}),
    },
    welcomeCard:
      welcomeCard?.enabled === true
        ? {
            enabled: true,
            headline: ctx.resolve(welcomeHeadline, "welcomeCard.headline"),
            ...(welcomeCard.subheader
              ? { subheader: ctx.resolve(welcomeCard.subheader, "welcomeCard.subheader") }
              : {}),
            buttonLabel: ctx.resolve(welcomeCard.buttonLabel ?? "Start", "welcomeCard.buttonLabel"),
            timeToFinish: true,
            showResponseCount: false,
          }
        : { enabled: false },
    blocks: generatedSurvey.blocks.map((block) => ({
      id: createId(),
      name: firstText(block.name),
      elements: block.questions.map((element) => buildElement(element, questionIndex++, ctx)),
    })),
    endings: [
      {
        id: createId(),
        type: "endScreen",
        headline: ctx.resolve(
          generatedSurvey.ending?.headline ?? "Thanks for your feedback",
          "endings.0.headline"
        ),
        ...(generatedSurvey.ending?.subheader
          ? { subheader: ctx.resolve(generatedSurvey.ending.subheader, "endings.0.subheader") }
          : {}),
      },
    ],
    hiddenFields: { enabled: false },
    variables: [],
    // AI generates content only. For app surveys, seed a valid default distribution (display once,
    // no triggers, no targeting) the user finishes wiring in the editor. Omitted scalars fall back to
    // the schema/DB defaults; the auto-created empty segment means "show to everyone".
    ...(input.type === "app" ? { distribution: { displayOption: "displayOnce", triggers: [] } } : {}),
  };
}

function serializeValidation(
  preparation: Extract<TV3SurveyPrepareResult<TV3CreateSurveyBody>, { ok: true }>
): TV3SurveyGenerateValidation {
  return {
    valid: true,
    invalid_params: [],
    languages: preparation.languageRequests,
  };
}

/**
 * Throws when the prompt is too thin to generate from. Exported so the streaming route can run the
 * same guard *before* it opens a response body — once a stream has begun, an RFC 9457 problem
 * response is no longer possible.
 */
export function assertV3SurveyGeneratePrompt(prompt: string): void {
  const invalidParams = getPromptInvalidParams(prompt);

  if (invalidParams.length > 0) {
    throw new V3SurveyGeneratePromptError(invalidParams);
  }
}

export type TSurveyDraftGenerationRequest<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  schemaName: string;
  schemaDescription: string;
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeout?: number;
};

/**
 * The model call shape shared by every draft source: Create with AI and the import lane pass their
 * own schema and prompts and inherit the temperature, output budget and timeout, so a streamed draft,
 * a blocking one and an imported one cannot drift on a hand-copied number.
 */
export function createSurveyDraftGenerationRequest<TSchema extends z.ZodTypeAny>(
  request: TSurveyDraftGenerationRequest<TSchema>
) {
  return {
    schema: request.schema,
    schemaName: request.schemaName,
    schemaDescription: request.schemaDescription,
    system: request.system,
    prompt: request.prompt,
    temperature: request.temperature ?? 0.2,
    maxOutputTokens: request.maxOutputTokens ?? V3_SURVEY_GENERATION_MAX_OUTPUT_TOKENS,
    timeout: request.timeout ?? V3_SURVEY_GENERATION_TIMEOUT_MS,
  };
}

/**
 * The exact model call both the blocking public route and the streaming internal route make. Every
 * field is common to `TGenerateObjectOptions` and `TStreamObjectOptions`, so both spread it — which
 * is what keeps a streamed draft identical to a blocking one rather than letting the two drift on a
 * hand-copied temperature.
 */
export function buildV3SurveyGenerationRequest(input: TV3SurveyGenerateBody) {
  return createSurveyDraftGenerationRequest({
    // Deliberately the *ForAI* schema (string ranges), not ZGeneratedSurveyDraft, which
    // z.preprocess-coerces them to numbers. z.preprocess does not survive JSON-Schema conversion,
    // so swapping the two here breaks provider structured output.
    schema: ZGeneratedSurveyDraftForAI,
    schemaName: "FormbricksSurveyDraft",
    schemaDescription: "A concise Formbricks survey draft that can be converted to a v3 create payload.",
    system: buildV3SurveyGenerationSystemPrompt(V3_SURVEY_GENERATE_ALLOWED_LOCALES, input.type),
    prompt: buildV3SurveyGenerationPrompt(
      input.prompt,
      input.type,
      input.language ?? DEFAULT_V3_SURVEY_LANGUAGE,
      V3_SURVEY_GENERATE_ALLOWED_LOCALES
    ),
  });
}

/** Tracing context, shared so both routes report under the same PostHog feature. */
export function buildV3SurveyGenerationTracing(params: { workspaceId: string; userId?: string | null }) {
  return params.userId
    ? {
        distinctId: params.userId,
        feature: AI_TRACING_FEATURE.SurveyGeneration,
        workspaceId: params.workspaceId,
      }
    : undefined;
}

export type TBuildDraftPayloadOptions = {
  /** The parsed-draft schema of the source (`internal` from the factory). Default: Create with AI's. */
  schema?: z.ZodType<TGeneratedDraftLike>;
  /** Import: the languages the payload must declare. Default: the draft's single `language`. */
  languages?: TDraftLanguages;
};

/**
 * Converts a raw model draft into a v3 create payload. Pure and synchronous — no I/O, no AI call.
 * Both the blocking and the streaming route converge here, so a regression in this function breaks
 * the documented public endpoint as well as the prototype.
 *
 * @param draft the raw model object. Unvalidated by construction, hence the safeParse: a streamed
 *   partial can carry a half-written string or a value that is not yet a legal enum member, so only
 *   a terminal draft should ever reach this.
 */
export function buildV3SurveyCreatePayloadFromDraft(
  input: TBuildCreatePayloadInput,
  draft: unknown,
  options: TBuildDraftPayloadOptions = {}
): TV3SurveyGenerateResult {
  const schema = options.schema ?? (ZGeneratedSurveyDraft as unknown as z.ZodType<TGeneratedDraftLike>);
  const generatedSurvey = schema.safeParse(draft);
  if (!generatedSurvey.success) {
    throw new V3SurveyGeneratedPayloadValidationError(
      formatV3ZodInvalidParams(generatedSurvey.error, "generatedSurvey")
    );
  }

  const normalizedGeneratedSurvey = normalizeGeneratedSurveyBlocks(generatedSurvey.data);
  const fills: TV3SurveyTranslationFill[] = [];
  const languages: TDraftLanguages = options.languages ?? {
    defaultLanguage: normalizedGeneratedSurvey.language,
    codes: [normalizedGeneratedSurvey.language],
  };
  const resolve = options.languages
    ? createMultilingualResolver(languages, fills)
    : createSingleLanguageResolver(languages.defaultLanguage);

  const createPayload = buildCreatePayload(input, normalizedGeneratedSurvey, languages, {
    resolve,
    defaultLanguage: languages.defaultLanguage,
  });
  const preparation = prepareV3SurveyCreateInput(createPayload);
  if (!preparation.ok) {
    throw new V3SurveyGeneratedPayloadValidationError(preparation.validation.invalidParams);
  }

  return {
    language: languages.defaultLanguage,
    payload: createPayload as TV3CreateSurveyBody,
    validation: serializeValidation(preparation),
    translationFills: fills,
  };
}

export async function generateV3SurveyCreatePayloadFromPrompt(params: {
  organizationId: string;
  workspaceId: string;
  userId?: string | null;
  input: TV3SurveyGenerateBody;
}): Promise<TV3SurveyGenerateResult> {
  assertV3SurveyGeneratePrompt(params.input.prompt);

  const generation = await generateOrganizationAIObject({
    organizationId: params.organizationId,
    aiTracing: buildV3SurveyGenerationTracing(params),
    ...buildV3SurveyGenerationRequest(params.input),
  });

  return buildV3SurveyCreatePayloadFromDraft(params.input, generation.object);
}
