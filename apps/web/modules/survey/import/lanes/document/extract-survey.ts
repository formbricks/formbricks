import "server-only";
import type { z } from "zod";
import {
  IMPORTED_SURVEY_ELEMENT_TYPES,
  IMPORTED_SURVEY_MAX_BLOCKS,
  IMPORTED_SURVEY_MAX_CHOICES,
  IMPORTED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
} from "@/app/api/v3/surveys/generate/constants";
import {
  GENERATED_CHOICE_MAX_LENGTH,
  GENERATED_DESCRIPTION_MAX_LENGTH,
  GENERATED_TEXT_MAX_LENGTH,
  type TGeneratedDraftLike,
  createGeneratedSurveyDraftSchema,
  createLocalizedText,
} from "@/app/api/v3/surveys/generate/schemas";
import { createSurveyDraftGenerationRequest } from "@/app/api/v3/surveys/generate/service";
import { generateOrganizationAIObject, streamOrganizationAIObject } from "@/lib/ai/service";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import { importError, importInfo } from "../../report";
import type { TImportIssue } from "../../types";
import { type TImportPromptPart, buildImportSystemPrompt, buildImportUserPrompt } from "./prompt";

/** Extraction is transcription, not creativity: the lowest temperature the providers accept reliably. */
const IMPORT_EXTRACTION_TEMPERATURE = 0.1;

export type TImportDraftSchema = ReturnType<typeof createImportDraftSchema>;

/**
 * The import draft schema for one call: localized text arrays whose `languageCode` enum is exactly the
 * detected codes (D2), the doubled caps (D4) and the extended element list.
 */
export function createImportDraftSchema(languageCodes: readonly string[]) {
  const codes = [...new Set(languageCodes)] as [string, ...string[]];
  if (codes.length === 0) {
    throw new Error("createImportDraftSchema needs at least one language code");
  }

  return createGeneratedSurveyDraftSchema({
    text: createLocalizedText(codes, GENERATED_TEXT_MAX_LENGTH),
    description: createLocalizedText(codes, GENERATED_DESCRIPTION_MAX_LENGTH),
    choice: createLocalizedText(codes, GENERATED_CHOICE_MAX_LENGTH),
    limits: {
      maxBlocks: IMPORTED_SURVEY_MAX_BLOCKS,
      maxQuestionsPerBlock: IMPORTED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
      maxChoices: IMPORTED_SURVEY_MAX_CHOICES,
    },
    elementTypes: IMPORTED_SURVEY_ELEMENT_TYPES,
    languageCodes: codes,
  });
}

export type TExtractSurveyDraftParams = {
  text: string;
  languageCodes: readonly string[];
  defaultLanguageCode: string;
  organizationId: string;
  workspaceId: string;
  userId?: string | null;
  part?: TImportPromptPart;
  signal?: AbortSignal;
};

/** The model call both the blocking and the streaming extraction make. */
export function buildImportDraftRequest(
  params: Pick<TExtractSurveyDraftParams, "text" | "languageCodes" | "defaultLanguageCode" | "part">,
  schema: TImportDraftSchema
) {
  return createSurveyDraftGenerationRequest({
    // The *ForAI* variant: string ranges, no z.preprocess (does not survive JSON-Schema conversion).
    schema: schema.forAI,
    schemaName: "FormbricksSurveyImportDraft",
    schemaDescription:
      "A Formbricks survey draft transcribed from an existing questionnaire, with one text entry per language.",
    system: buildImportSystemPrompt(),
    prompt: buildImportUserPrompt(params),
    temperature: IMPORT_EXTRACTION_TEMPERATURE,
  });
}

function buildTracing(params: Pick<TExtractSurveyDraftParams, "userId" | "workspaceId">) {
  return params.userId
    ? { distinctId: params.userId, feature: AI_TRACING_FEATURE.SurveyImport, workspaceId: params.workspaceId }
    : undefined;
}

export type TExtractedSurveyDraft = {
  /** The parsed draft (ranges coerced), or null when the document held no questions. */
  draft: TGeneratedDraftLike | null;
  /** Language codes actually used by the draft's texts, default first. */
  languageCodes: string[];
  defaultLanguageCode: string;
  issues: TImportIssue[];
};

function collectUsedLanguageCodes(draft: TGeneratedDraftLike, defaultLanguageCode: string): string[] {
  const used = new Set<string>([defaultLanguageCode]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object" && "languageCode" in entry && "text" in entry) {
          used.add(String((entry as { languageCode: unknown }).languageCode));
        } else {
          visit(entry);
        }
      }
    } else if (value && typeof value === "object") {
      for (const nested of Object.values(value)) visit(nested);
    }
  };
  visit(draft);
  return [...used];
}

/**
 * Turns a raw model object into the extraction result: validates it against the `internal` schema, turns
 * `notes` into `model_note` infos and an empty draft into the fatal `nothing_extracted`. Shared by the
 * blocking call and the streaming route's terminal object.
 */
export function finalizeImportDraft(
  raw: unknown,
  schema: TImportDraftSchema,
  defaultLanguageCode: string
): TExtractedSurveyDraft {
  // An empty draft fails the schema's minimums, so the "nothing there" case is recognised before parsing.
  const rawBlocks = (raw as { blocks?: unknown } | null)?.blocks;
  const rawIsEmpty =
    Array.isArray(rawBlocks) &&
    rawBlocks.every(
      (block) =>
        !Array.isArray((block as { questions?: unknown })?.questions) ||
        (block as { questions: unknown[] }).questions.length === 0
    );
  if (rawIsEmpty) {
    return {
      draft: null,
      languageCodes: [defaultLanguageCode],
      defaultLanguageCode,
      issues: [importError({ code: "nothing_extracted" })],
    };
  }

  const parsed = schema.internal.safeParse(raw);
  if (!parsed.success) {
    return {
      draft: null,
      languageCodes: [defaultLanguageCode],
      defaultLanguageCode,
      issues: [
        importError({
          code: "invalid_document",
          vars: {
            detail: `The model returned an unreadable draft (${parsed.error.issues[0]?.message ?? "unknown"}).`,
          },
        }),
      ],
    };
  }

  const draft = parsed.data as TGeneratedDraftLike;
  const issues: TImportIssue[] = [];
  const noteIssue = (detail: string, path?: string) =>
    importInfo({ code: "model_note", vars: { detail }, ...(path ? { path } : {}) });
  for (const note of draft.notes ?? []) issues.push(noteIssue(note));
  let questionIndex = 0;
  for (const block of draft.blocks) {
    for (const question of block.questions) {
      for (const note of question.notes ?? []) {
        issues.push(noteIssue(note, `questions.${questionIndex}`));
      }
      questionIndex += 1;
    }
  }

  const resolvedDefault = draft.defaultLanguage ?? defaultLanguageCode;
  return {
    draft,
    languageCodes: collectUsedLanguageCodes(draft, resolvedDefault),
    defaultLanguageCode: resolvedDefault,
    issues,
  };
}

/** One blocking extraction call. The caller decides chunking and passes `part` for anything but a whole document. */
export async function extractSurveyDraft(params: TExtractSurveyDraftParams): Promise<TExtractedSurveyDraft> {
  const schema = createImportDraftSchema(params.languageCodes);
  const generation = await generateOrganizationAIObject({
    organizationId: params.organizationId,
    aiTracing: buildTracing(params),
    abortSignal: params.signal,
    ...buildImportDraftRequest(params, schema),
  });

  return finalizeImportDraft(generation.object, schema, params.defaultLanguageCode);
}

export type TStreamedSurveyDraft = {
  schema: TImportDraftSchema;
  partialObjectStream: Awaited<ReturnType<typeof streamOrganizationAIObject>>["partialObjectStream"];
  /** Resolves to the finalized draft once the model is done; rejects on provider failure. */
  completion: Promise<TExtractedSurveyDraft>;
};

/** Streaming counterpart for the NDJSON route: same request, partials for the preview, the finalized draft at the end. */
export async function streamSurveyDraft(params: TExtractSurveyDraftParams): Promise<TStreamedSurveyDraft> {
  const schema = createImportDraftSchema(params.languageCodes);
  const result = await streamOrganizationAIObject<z.infer<TImportDraftSchema["forAI"]>>({
    organizationId: params.organizationId,
    aiTracing: buildTracing(params),
    abortSignal: params.signal,
    ...buildImportDraftRequest(params, schema),
  });

  return {
    schema,
    partialObjectStream: result.partialObjectStream,
    completion: result.completion.then((object) =>
      finalizeImportDraft(object, schema, params.defaultLanguageCode)
    ),
  };
}
