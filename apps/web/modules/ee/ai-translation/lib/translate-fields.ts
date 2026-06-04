import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { generateOrganizationAIObject } from "@/lib/ai/service";

export const ZAITranslationField = z.object({
  path: z.string(),
  defaultText: z.string(),
  isRichText: z.boolean(),
});

export type TAITranslationField = z.infer<typeof ZAITranslationField>;

interface TranslateFieldsInput {
  organizationId: string;
  fields: TAITranslationField[];
  sourceLanguage: string;
  targetLanguage: string;
}

export const translateFields = async ({
  organizationId,
  fields,
  sourceLanguage,
  targetLanguage,
}: TranslateFieldsInput): Promise<Record<string, string>> => {
  if (fields.length === 0) {
    return {};
  }

  // Indexed IDs insulate the LLM from user-supplied paths (dots, casing,
  // separator normalization). We map back to paths after generation.
  const items = fields.map((f, i) => ({
    id: `t${i}`,
    path: f.path,
    text: f.defaultText,
    richText: f.isRichText,
  }));

  // Schema with explicit keys forces the provider to return exactly this set.
  const schema = z.object(Object.fromEntries(items.map((item) => [item.id, z.string()])));

  const systemPrompt = `You are a professional translator for survey content. Translate each item from ${sourceLanguage} to ${targetLanguage}.

Rules:
- For rich text items (richText: true), preserve all HTML tags exactly. Only translate the text content within the tags.
- Preserve any {{variable}} patterns exactly — do not translate text inside double curly braces.
- Translate every item. Do not omit any keys.`;

  const userPayload = JSON.stringify(items.map(({ id, text, richText }) => ({ id, text, richText })));

  const result = await generateOrganizationAIObject({
    organizationId,
    schema,
    system: systemPrompt,
    prompt: userPayload,
    temperature: 0,
  });

  const translatedById = result.object as Record<string, string>;

  const translations: Record<string, string> = {};
  const missingIds: string[] = [];
  for (const item of items) {
    const value = translatedById[item.id];
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
        requestedCount: fields.length,
        returnedCount: Object.keys(translations).length,
        missingIds,
      },
      "AI translation returned incomplete result"
    );
    throw new Error("AI translation returned incomplete result");
  }

  return translations;
};
