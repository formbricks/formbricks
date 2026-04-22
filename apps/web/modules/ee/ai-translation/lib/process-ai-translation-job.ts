import "server-only";
import type { JobExecutionContext, TAITranslationJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { generateOrganizationAIText } from "@/lib/ai/service";
import { cache } from "@/lib/cache";

const AI_TRANSLATION_RESULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getAITranslationCacheKey = (jobId: string): string => `ai-translation-result:${jobId}`;

export const processAITranslationJob = async (
  data: TAITranslationJobData,
  context: JobExecutionContext
): Promise<void> => {
  const { organizationId, fields, sourceLanguage, targetLanguage } = data;

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

  // Parse AI response as JSON
  let parsed: Record<string, string>;
  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
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

  // Store result in Redis for the polling action to pick up
  const cacheKey = getAITranslationCacheKey(context.jobId);
  await cache.set(cacheKey, translations, AI_TRANSLATION_RESULT_TTL_MS);

  logger.info(
    {
      jobId: context.jobId,
      workspaceId: data.workspaceId,
      fieldCount: fields.length,
      translatedCount: Object.keys(translations).length,
    },
    "AI translation job completed"
  );
};
