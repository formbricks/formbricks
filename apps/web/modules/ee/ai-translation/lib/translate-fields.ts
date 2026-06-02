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

const ZTranslationResponse = z.object({
  translations: z.record(z.string(), z.string()),
});
type TTranslationResponse = z.infer<typeof ZTranslationResponse>;

export const translateFields = async ({
  organizationId,
  fields,
  sourceLanguage,
  targetLanguage,
}: TranslateFieldsInput): Promise<Record<string, string>> => {
  const items = fields.map((f) => ({
    key: f.path,
    text: f.defaultText,
    richText: f.isRichText,
  }));

  const systemPrompt = `You are a professional translator for survey content. Translate the provided survey fields from ${sourceLanguage} to ${targetLanguage}.

Rules:
- The response MUST be an object of the form { "translations": { <key>: <translated text>, ... } }.
- Use the "key" field from each input item EXACTLY as the key in the translations object. Do not modify, escape, nest, or rewrite the key in any way — keys like "blocks.0.elements.0.headline" must appear verbatim, NOT as nested objects.
- Include one entry per input item; do not invent, drop, or merge keys.
- For rich text fields (richText: true), preserve all HTML tags exactly. Only translate the text content within the tags.
- Preserve any {{variable}} patterns exactly — never translate text inside double curly braces.`;

  const { object } = await generateOrganizationAIObject<TTranslationResponse>({
    organizationId,
    schema: ZTranslationResponse,
    system: systemPrompt,
    prompt: JSON.stringify(items),
  });

  const validKeys = new Set(fields.map((f) => f.path));
  const translations: Record<string, string> = {};
  for (const [key, value] of Object.entries(object.translations)) {
    if (validKeys.has(key)) {
      translations[key] = value;
    }
  }

  if (Object.keys(translations).length === 0) {
    logger.error(
      {
        requestedKeys: fields.map((f) => f.path),
        returnedKeys: Object.keys(object.translations),
      },
      "AI translation response had no keys matching the requested fields"
    );
    throw new Error("AI translation response had no usable translations");
  }

  return translations;
};
