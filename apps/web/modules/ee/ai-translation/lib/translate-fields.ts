import "server-only";
import { z } from "zod";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { AI_DEFAULT_TIMEOUT_MS } from "@formbricks/types/ai-timeout";
import { InvalidInputError } from "@formbricks/types/errors";
import { redactAIError } from "@/lib/ai/loggable-error";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { getAITimeoutMs } from "@/lib/ai/timeout";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import { AI_TRANSLATION_MODEL_BATCHES_PER_ACTION, createTranslationBatches } from "./translation-batches";

export const ZAITranslationField = z.object({
  path: z.string(),
  defaultText: z.string(),
  isRichText: z.boolean(),
});

export type TAITranslationField = z.infer<typeof ZAITranslationField>;

const AI_TRANSLATION_TIMEOUT_MS = AI_DEFAULT_TIMEOUT_MS;
const AI_TRANSLATION_MIN_OUTPUT_TOKENS = 1024;
const AI_TRANSLATION_MAX_OUTPUT_TOKENS = 8192;
const AI_TRANSLATION_OUTPUT_TOKENS_PER_FIELD = 160;

export const AI_TRANSLATION_OUTPUT_TOO_LONG = "ai_output_too_long";

interface TranslateFieldsInput {
  organizationId: string;
  workspaceId: string;
  userId: string;
  fields: TAITranslationField[];
  sourceLanguage: string;
  targetLanguage: string;
}

export const translateFields = async ({
  organizationId,
  workspaceId,
  userId,
  fields,
  sourceLanguage,
  targetLanguage,
}: TranslateFieldsInput): Promise<Record<string, string>> => {
  if (fields.length === 0) {
    return {};
  }

  // Empty defaultText is valid per the schema but has no meaningful translation.
  // Echo it through unchanged so callers still see every requested path in the
  // result, instead of aborting the whole batch when the model "fails" to
  // translate an empty string.
  const translatableFields: TAITranslationField[] = [];
  const passthroughTranslations: Record<string, string> = {};
  for (const field of fields) {
    if (field.defaultText.length === 0) {
      passthroughTranslations[field.path] = "";
    } else {
      translatableFields.push(field);
    }
  }

  if (translatableFields.length === 0) {
    return passthroughTranslations;
  }

  const systemPrompt = `You are a professional translator for survey content. Translate each item from ${sourceLanguage} to ${targetLanguage}.

Rules:
- For rich text items (richText: true), preserve all HTML tags exactly. Only translate the text content within the tags.
- Preserve any {{variable}} patterns exactly — do not translate text inside double curly braces.
- Translate every item. Do not omit any keys.`;

  const translateBatch = async (batch: TAITranslationField[]): Promise<Record<string, string>> => {
    // Indexed IDs insulate the LLM from user-supplied paths. Map them back after generation.
    const items = batch.map((field, index) => ({
      id: `t${index}`,
      path: field.path,
      text: field.defaultText,
      richText: field.isRichText,
    }));
    const schema = z.object(Object.fromEntries(items.map((item) => [item.id, z.string()])));
    const userPayload = JSON.stringify(items.map(({ id, text, richText }) => ({ id, text, richText })));
    const sourceChars = batch.reduce((total, field) => total + field.defaultText.length, 0);
    const maxOutputTokens = Math.min(
      AI_TRANSLATION_MAX_OUTPUT_TOKENS,
      Math.max(
        AI_TRANSLATION_MIN_OUTPUT_TOKENS,
        batch.length * AI_TRANSLATION_OUTPUT_TOKENS_PER_FIELD,
        sourceChars
      )
    );

    const result = await generateOrganizationAIObject({
      organizationId,
      aiTracing: { distinctId: userId, feature: AI_TRACING_FEATURE.Translation, workspaceId },
      schema,
      system: systemPrompt,
      prompt: userPayload,
      temperature: 0,
      maxOutputTokens,
      timeout: getAITimeoutMs(AI_TRANSLATION_TIMEOUT_MS),
    }).catch((error: unknown) => {
      if (error instanceof AIOutputTokenLimitError) {
        throw new InvalidInputError(AI_TRANSLATION_OUTPUT_TOO_LONG);
      }
      // AI SDK errors can contain survey text and model output. Keep them out of the action response.
      throw redactAIError(error);
    });

    const translations: Record<string, string> = {};
    const missingIds: string[] = [];
    for (const item of items) {
      const value = result.object[item.id];
      if (typeof value === "string" && value.length > 0) {
        translations[item.path] = value;
      } else {
        missingIds.push(item.id);
      }
    }

    if (missingIds.length > 0) {
      logger.error(
        {
          organizationId,
          sourceLanguage,
          targetLanguage,
          requestedCount: batch.length,
          returnedCount: Object.keys(translations).length,
          missingIds,
        },
        "AI translation returned incomplete result"
      );
      throw new Error("AI translation returned incomplete result");
    }

    return translations;
  };

  const modelBatches = createTranslationBatches(translatableFields);
  const translations: Record<string, string> = {};
  for (let index = 0; index < modelBatches.length; index += AI_TRANSLATION_MODEL_BATCHES_PER_ACTION) {
    const results = await Promise.all(
      modelBatches.slice(index, index + AI_TRANSLATION_MODEL_BATCHES_PER_ACTION).map(translateBatch)
    );
    for (const result of results) Object.assign(translations, result);
  }

  return { ...passthroughTranslations, ...translations };
};
