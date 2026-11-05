import { Output, asSchema, generateText } from "ai";
import { AIOutputTokenLimitError } from "./errors";
import { getAiModel } from "./provider";
import { getOpenAICompatibleProviderName } from "./providers/openai-compatible";
import { withLowReasoning } from "./reasoning";
import { getAIEnvironment, parseBooleanFlag, resolveActiveAIProvider } from "./shared";
import type {
  AIEnvironment,
  AIResolvedLanguageModel,
  TGenerateObjectOptions,
  TGenerateObjectResult,
} from "./types";

/** A provider name as the OpenAI-compatible adapter camel-cases it for its options' key. */
const toCamelCase = (name: string): string =>
  name.replaceAll(/[_-]([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/**
 * `providerOptions` with strict JSON-schema decoding turned off, under every key a strict-decoding
 * adapter reads its options from: `openai` and `azure` (the Azure adapter reads `azure`, else
 * `openai`), and the OpenAI-compatible adapter's own name, as given and camel-cased. A key no configured
 * adapter reads is ignored.
 * The `azure` entry starts from the caller's `openai` options when it has none of its own, so adding it
 * does not hide them from the Azure adapter.
 */
const withoutStrictSchema = (
  providerOptions: TGenerateObjectOptions["providerOptions"],
  environment?: AIEnvironment
): NonNullable<TGenerateObjectOptions["providerOptions"]> => {
  const providerName = getOpenAICompatibleProviderName(getAIEnvironment(environment));
  const keys = new Set([
    "openai",
    "azure",
    "openaiCompatible",
    providerName,
    // The OpenAI-compatible adapter also reads the name camel-cased (`custom-provider` → `customProvider`),
    // last, so it would win.
    toCamelCase(providerName),
  ]);
  const options = { ...providerOptions };
  for (const key of keys) {
    const own =
      key === "azure" ? (providerOptions?.azure ?? providerOptions?.openai) : providerOptions?.[key];
    options[key] = { ...own, strictJsonSchema: false };
  }
  return options;
};

/**
 * Whether the configured provider decodes against the JSON schema itself. Azure, Bedrock and Vertex do;
 * an OpenAI-compatible endpoint only when `AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS` says so.
 * Without it the AI SDK asks only for "a JSON object" and drops the schema from the request.
 */
const providerDecodesSchema = (environment?: AIEnvironment): boolean => {
  const resolved = getAIEnvironment(environment);
  if (resolveActiveAIProvider(resolved.AI_PROVIDER) !== "openai-compatible") return true;
  return parseBooleanFlag(resolved.AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS);
};

/**
 * What a provider asked only for "a JSON object" is told about the answer's shape: the JSON Schema it
 * must match, compact. Exported so a caller that budgets its prompt can count it.
 */
export const buildSchemaInstructions = async (schema: TGenerateObjectOptions["schema"]): Promise<string> => {
  const jsonSchema = JSON.stringify(await asSchema(schema).jsonSchema);
  return `Answer with one JSON object that matches this JSON Schema exactly: the same property names and nesting, every required property present, no other properties.\n${jsonSchema}`;
};

/** Characters `buildSchemaInstructions` adds after a system prompt, the separator included. */
export const SCHEMA_INSTRUCTIONS_SEPARATOR = "\n\n";

/**
 * The caller's system prompt, followed by the JSON Schema the answer must match, for a provider that is
 * asked only for "a JSON object": without the schema, a model makes up its own shape, and the answer
 * fails validation. A prompt given as text gets the schema after it; one given as messages gets it as a
 * system message of its own after them.
 */
const withSchemaInstructions = async (
  system: TGenerateObjectOptions["system"],
  schema: TGenerateObjectOptions["schema"]
): Promise<TGenerateObjectOptions["system"]> => {
  const instructions = await buildSchemaInstructions(schema);
  if (system === undefined || system === "") return instructions;
  if (typeof system === "string") return `${system}${SCHEMA_INSTRUCTIONS_SEPARATOR}${instructions}`;
  const schemaMessage = { role: "system" as const, content: instructions };
  return Array.isArray(system) ? [...system, schemaMessage] : [system, schemaMessage];
};

export const generateObject = async <T = unknown>(
  options: TGenerateObjectOptions<T>,
  environment?: AIEnvironment,
  wrapModel?: (model: AIResolvedLanguageModel) => AIResolvedLanguageModel
): Promise<TGenerateObjectResult<T>> => {
  const {
    schema,
    schemaName,
    schemaDescription,
    output: _output,
    strictSchema,
    lowReasoning,
    ...callOptions
  } = options;
  const resolved = getAIEnvironment(environment);
  const textOptions = lowReasoning
    ? {
        ...callOptions,
        providerOptions: withLowReasoning(
          callOptions.providerOptions,
          resolveActiveAIProvider(resolved.AI_PROVIDER),
          resolved.AI_MODEL
        ),
      }
    : callOptions;
  const model = getAiModel(environment);
  const request = {
    ...textOptions,
    ...(providerDecodesSchema(environment)
      ? {}
      : { system: await withSchemaInstructions(textOptions.system, schema) }),
    ...(strictSchema === false
      ? { providerOptions: withoutStrictSchema(textOptions.providerOptions, environment) }
      : {}),
    model: wrapModel ? wrapModel(model as AIResolvedLanguageModel) : model,
    output: Output.object<T>({
      schema,
      name: schemaName,
      description: schemaDescription,
    }),
  } as Parameters<typeof generateText>[0];

  const result = await generateText(request);

  // With `output: Output.object(...)`, the AI SDK only parses `result.output` when the generation
  // finished with "stop"; on "length" the getter throws a bare NoOutputGeneratedError. Throw a
  // dedicated error first so callers can tell "output token limit reached" apart from other failures.
  if (result.finishReason === "length") {
    throw new AIOutputTokenLimitError({
      maxOutputTokens: textOptions.maxOutputTokens,
      outputTokens: result.usage.outputTokens,
      reasoningTokens: result.usage.outputTokenDetails.reasoningTokens,
    });
  }

  const object = result.output as T;

  return {
    object,
    reasoning: result.reasoningText,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
    request: result.request,
    response: result.response,
    providerMetadata: result.providerMetadata,
    toJsonResponse(init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }

      return new Response(JSON.stringify(object), {
        ...init,
        headers,
      });
    },
  };
};
