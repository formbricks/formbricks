import {
  APICallError,
  InvalidResponseDataError,
  JSONParseError,
  NoObjectGeneratedError,
  RetryError,
  TypeValidationError,
} from "ai";

/**
 * Real AI SDK errors, built the way the SDK builds them, with user content planted in every place the
 * SDK puts it: the message, the request body (the prompt), the provider's response body, the model's
 * output, and the same again inside causes and retry attempts. Every planted string contains
 * `PLANTED_USER_CONTENT`, so a test asserts that a sink received none of it with `findPlantedContent`.
 */
export const PLANTED_USER_CONTENT = "planted-user-content-eng-3720";

const planted = (where: string) => `${PLANTED_USER_CONTENT}:${where}`;

export const buildProviderCallError = (statusCode = 500): APICallError =>
  new APICallError({
    message: `Bad request: ${planted("api-message")}`,
    url: "https://provider.example.com/v1/chat/completions",
    requestBodyValues: {
      model: "test-model",
      messages: [
        { role: "system", content: planted("system-prompt") },
        { role: "user", content: planted("user-prompt") },
      ],
    },
    statusCode,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ error: { message: planted("response-body") } }),
    data: { error: { message: planted("response-data") } },
  });

/** What the SDK throws once it gives up retrying: every attempt kept, the last one repeated in the message. */
export const buildRetryError = (): RetryError => {
  const attempts = [buildProviderCallError(500), buildProviderCallError(503), buildProviderCallError(500)];
  return new RetryError({
    message: `Failed after 3 attempts. Last error: ${attempts[2].message}`,
    reason: "maxRetriesExceeded",
    errors: attempts,
  });
};

/** Output that did not match the schema: the model's text on the error, its parsed value on the cause. */
export const buildNoObjectError = (): NoObjectGeneratedError =>
  new NoObjectGeneratedError({
    message: "No object generated: response did not match schema.",
    cause: new TypeValidationError({
      value: { t0: planted("model-output-value") },
      cause: new Error(planted("validation-detail")),
    }),
    text: JSON.stringify({ t0: planted("model-output-text") }),
    response: { id: "response-1", timestamp: new Date(0), modelId: "test-model" },
    usage: {
      inputTokens: 10,
      inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokens: 20,
      outputTokenDetails: { textTokens: 20, reasoningTokens: 0 },
      totalTokens: 30,
    },
    finishReason: "stop",
  });

/** Output that was not JSON at all: the raw text sits in the cause's message as well as its field. */
export const buildUnparseableOutputError = (): JSONParseError =>
  new JSONParseError({ text: planted("unparseable-output"), cause: new SyntaxError(planted("syntax")) });

export const buildInvalidResponseDataError = (): InvalidResponseDataError =>
  new InvalidResponseDataError({ data: { choices: [{ text: planted("invalid-response-data") }] } });

/** Every shape above, named for `test.each`. */
export const LEAKY_AI_ERRORS: ReadonlyArray<readonly [string, () => Error]> = [
  ["APICallError", () => buildProviderCallError()],
  ["RetryError", buildRetryError],
  ["NoObjectGeneratedError", buildNoObjectError],
  ["JSONParseError", buildUnparseableOutputError],
  ["InvalidResponseDataError", buildInvalidResponseDataError],
  [
    "an app error wrapping an APICallError",
    () => new Error(`Wrapped: ${planted("wrapper-message")}`, { cause: buildProviderCallError() }),
  ],
];

/**
 * The path of the first string under `value` that contains planted content, or undefined. Walks every own
 * property — non-enumerable ones too — and an Error's `name`, `message`, `stack` and `cause` wherever they
 * live, through arrays, plain objects and errors. A sink can only print what is reachable this way, so a clean result
 * holds for pino's serializer, Sentry's event builder and anything else that reads the value.
 */
export const findPlantedContent = (
  value: unknown,
  path = "$",
  seen: WeakSet<object> = new WeakSet()
): string | undefined => {
  if (typeof value === "string") {
    return value.includes(PLANTED_USER_CONTENT) ? path : undefined;
  }
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  // An error's name, message and stack can live on its prototype chain depending on the runtime; a
  // sink reads them either way, so they are searched either way.
  const errorKeys = value instanceof Error ? ["name", "message", "stack", "cause"] : [];
  for (const key of new Set<PropertyKey>([...Reflect.ownKeys(value), ...errorKeys])) {
    const found = findPlantedContent(
      (value as Record<PropertyKey, unknown>)[key],
      `${path}.${String(key)}`,
      seen
    );
    if (found) return found;
  }
  return undefined;
};
