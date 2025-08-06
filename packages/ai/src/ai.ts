import { generateObject as aiGenerateObject, generateText as aiGenerateText } from "ai";
import type { z } from "zod";
import { createAIModel } from "./config";
import type {
  GenerateObjectOptions,
  GenerateObjectResult,
  GenerateTextOptions,
  GenerateTextResult,
  ProviderConfig,
} from "./types";

/**
 * Singleton AI model instance for reuse across calls
 */
let aiModelInstance: ReturnType<typeof createAIModel> | null = null;

/**
 * Get or create the AI model instance
 */
function getAIModel(customConfig?: ProviderConfig) {
  if (!aiModelInstance || customConfig) {
    aiModelInstance = createAIModel(customConfig);
  }
  return aiModelInstance;
}

/**
 * Generate text using the configured AI model
 *
 * @param options - Text generation options
 * @returns Promise resolving to generated text and usage information
 *
 * @example
 * ```typescript
 * const result = await generateText({
 *   prompt: "Summarize the following text: Lorem ipsum...",
 *   system: "You are a helpful assistant that provides concise summaries.",
 *   temperature: 0.7,
 *   maxTokens: 150
 * });
 *
 * console.log(result.text);
 * ```
 */
export async function generateText(
  options: GenerateTextOptions,
  customConfig?: ProviderConfig
): Promise<GenerateTextResult> {
  const { model } = getAIModel(customConfig);

  try {
    const result = await aiGenerateText({
      model,
      prompt: options.prompt,
      system: options.system,
      temperature: options.temperature,
      ...(options.maxTokens && { maxTokens: options.maxTokens }),
    });

    return {
      text: result.text,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  } catch (error) {
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a structured object using the configured AI model
 *
 * @param options - Object generation options including Zod schema
 * @returns Promise resolving to generated object and usage information
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 *
 * const summarySchema = z.object({
 *   title: z.string(),
 *   summary: z.string(),
 *   keyPoints: z.array(z.string()),
 *   sentiment: z.enum(['positive', 'negative', 'neutral'])
 * });
 *
 * const result = await generateObject({
 *   prompt: "Analyze the following article: Lorem ipsum...",
 *   schema: summarySchema,
 *   system: "You are an expert content analyzer.",
 *   temperature: 0.3
 * });
 *
 * console.log(result.object.title);
 * console.log(result.object.keyPoints);
 * ```
 */
export async function generateObject<T extends z.ZodSchema>(
  options: GenerateObjectOptions<T>,
  customConfig?: ProviderConfig
): Promise<GenerateObjectResult<z.infer<T>>> {
  const { model } = getAIModel(customConfig);

  try {
    const result = await aiGenerateObject({
      model,
      prompt: options.prompt,
      schema: options.schema,
      system: options.system,
      temperature: options.temperature,
      ...(options.maxTokens && { maxTokens: options.maxTokens }),
    });

    return {
      object: result.object,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  } catch (error) {
    throw new Error(`Failed to generate object: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function for text summarization
 *
 * @param text - Text to summarize
 * @param maxLength - Optional maximum length for the summary
 * @returns Promise resolving to the summary
 */
export async function summarizeText(
  text: string,
  maxLength?: number,
  customConfig?: ProviderConfig
): Promise<string> {
  const prompt = `Summarize the following text${maxLength ? ` in approximately ${maxLength} characters` : ""}:\n\n${text}`;

  const result = await generateText(
    {
      prompt,
      system:
        "You are a helpful assistant that creates clear, concise summaries. Focus on the key points and main ideas.",
      temperature: 0.3,
      maxTokens: maxLength ? Math.ceil(maxLength / 3) : undefined, // Rough token estimate
    },
    customConfig
  );

  return result.text;
}

/**
 * Helper function for text translation
 *
 * @param text - Text to translate
 * @param targetLanguage - Target language for translation
 * @param sourceLanguage - Optional source language (auto-detected if not provided)
 * @returns Promise resolving to the translated text
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  customConfig?: ProviderConfig
): Promise<string> {
  const sourceText = sourceLanguage ? `from ${sourceLanguage} ` : "";
  const prompt = `Translate the following text ${sourceText}to ${targetLanguage}:\n\n${text}`;

  const result = await generateText(
    {
      prompt,
      system: `You are a professional translator. Provide only the translated text without any additional commentary or explanations. Maintain the original tone and style.`,
      temperature: 0.1, // Low temperature for consistency
    },
    customConfig
  );

  return result.text;
}

/**
 * Reset the AI model instance (useful for testing or when configuration changes)
 */
export function resetAIModel(): void {
  aiModelInstance = null;
}
