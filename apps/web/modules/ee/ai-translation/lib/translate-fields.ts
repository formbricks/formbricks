import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { generateOrganizationAIText } from "@/lib/ai/service";

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
  const items = fields.map((f) => ({
    key: f.path,
    text: f.defaultText,
    richText: f.isRichText,
  }));

  const systemPrompt = `You are a professional translator for survey content. Translate the provided survey fields from ${sourceLanguage} to ${targetLanguage}.

Rules:
- Return ONLY a valid JSON object mapping each "key" to its translated text.
- For rich text fields (richText: true), preserve all HTML tags exactly as they are. Only translate the text content within the tags.
- Preserve any {{variable}} patterns exactly as they are — do not translate text inside double curly braces.
- Do not add any explanation, markdown formatting, or extra text — return raw JSON only.`;

  const result = await generateOrganizationAIText({
    organizationId,
    capability: "smartTools",
    system: systemPrompt,
    prompt: JSON.stringify(items),
  });

  // Parse AI response as JSON.
  // 1. Strip markdown code fences if present, then try JSON.parse directly.
  // 2. Fall back to extracting the first {...} block for wrapper text.
  let parsed: Record<string, string>;
  try {
    const stripped = result.text.replaceAll(/^```(?:json)?\s*\n?|\n?```\s*$/g, "").trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON object found in AI response");
      }
      parsed = JSON.parse(stripped.slice(start, end + 1));
    }
  } catch (parseError) {
    logger.error(
      { rawResponse: result.text.slice(0, 500), parseError },
      "Failed to parse AI translation response"
    );
    throw new Error("Failed to parse AI translation response");
  }

  // Validate and filter to only requested keys
  const validKeys = new Set(fields.map((f) => f.path));
  const translations: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (validKeys.has(key) && typeof value === "string") {
      translations[key] = value;
    }
  }

  return translations;
};
