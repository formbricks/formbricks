import {
  LEAKY_AI_ERRORS,
  PLANTED_USER_CONTENT,
  buildNoObjectError,
  buildProviderCallError,
  buildRetryError,
  findPlantedContent,
} from "@/lib/ai/__mocks__/leaky-ai-errors";
import { RetryError } from "ai";
import { describe, expect, test } from "vitest";
import { AIOAuthTokenError, AIOutputTokenLimitError } from "@formbricks/ai";
import { InvalidInputError, TooManyRequestsError } from "@formbricks/types/errors";
import { stackFrames } from "@/lib/utils/loggable-error";
import {
  RedactedAIError,
  describeAIError,
  isAISDKErrorChain,
  loggableAIError,
  redactAIError,
} from "./loggable-error";

describe("loggableAIError", () => {
  test.each(LEAKY_AI_ERRORS)("logs nothing the call filled in from %s", (_, build) => {
    const error = build();
    // The fixture has to carry the content for this test to mean anything.
    expect(findPlantedContent(error)).toBeDefined();

    const logged = loggableAIError(error);

    expect(findPlantedContent(logged)).toBeUndefined();
    expect(logged).toMatchObject({
      errName: error.name,
      errStack: expect.stringMatching(/^ +at \S.*(?:\n +at \S.*)*$/),
    });
  });

  test("keeps the provider status and how the retries ended", () => {
    expect(loggableAIError(buildRetryError())).toMatchObject({
      errName: "AI_RetryError",
      providerStatusCode: 500,
      retryReason: "maxRetriesExceeded",
      retryAttempts: 3,
      lastErrName: "AI_APICallError",
    });
  });

  test("finds the provider status of an AI SDK error under a cause", () => {
    const wrapped = new Error("outer", {
      cause: new Error("middle", { cause: buildProviderCallError(429) }),
    });

    expect(loggableAIError(wrapped)).toMatchObject({ providerStatusCode: 429 });
  });

  test("stops on a cause cycle that carries no status, without one", () => {
    const error = new Error("loop");
    error.cause = error;

    expect(loggableAIError(error)).not.toHaveProperty("providerStatusCode");
  });

  test("names the token-endpoint failure that ended the retries by its code", () => {
    const error = new RetryError({
      message: "Failed after 2 attempts. Last error: OAuth2 token endpoint did not respond in time",
      reason: "maxRetriesExceeded",
      errors: [
        buildProviderCallError(502),
        new AIOAuthTokenError("token_endpoint_timeout", { tokenUrlHost: "idp.example.com" }),
      ],
    });

    expect(loggableAIError(error)).toMatchObject({
      lastErrName: "AIOAuthTokenError",
      lastErrCode: "token_endpoint_timeout",
    });
  });

  test("names the causes that tell a schema mismatch from unparseable output, and why the model stopped", () => {
    expect(loggableAIError(buildNoObjectError())).toMatchObject({
      errName: "AI_NoObjectGeneratedError",
      errCauseNames: ["AI_TypeValidationError", "Error"],
      finishReason: "stop",
    });
  });

  test("records a cause that is not an Error by its type alone", () => {
    const error = new Error("wrapped", { cause: "planted text" });

    expect(describeAIError(error)).toMatchObject({ errCauseNames: ["string"] });
  });

  test("logs only the type of something thrown that is not an Error", () => {
    expect(loggableAIError("planted text")).toEqual({ errType: "string" });
  });
});

describe("redactAIError", () => {
  test.each(LEAKY_AI_ERRORS)("replaces %s with an error that carries none of the call", (_, build) => {
    const error = build();

    const redacted = redactAIError(error);

    expect(redacted).toBeInstanceOf(RedactedAIError);
    expect(findPlantedContent(redacted)).toBeUndefined();
    expect(redacted).toMatchObject({ name: "RedactedAIError", originalName: error.name });
    expect((redacted as Error).cause).toBeUndefined();
  });

  test("keeps the original's frames, under a header its own frame filter accepts", () => {
    const redacted = redactAIError(buildProviderCallError(429)) as RedactedAIError;

    expect(redacted.providerStatusCode).toBe(429);
    expect(redacted.message).toContain("AI_APICallError (provider status 429)");
    expect(stackFrames(redacted).join("\n")).toContain("leaky-ai-errors");
  });

  test.each([
    ["a quota error", new TooManyRequestsError("ai_quota_exceeded", 30)],
    ["an input error", new InvalidInputError("ai_output_too_long")],
    ["a token-limit error", new AIOutputTokenLimitError({ maxOutputTokens: 10 })],
    ["a token-endpoint error", new AIOAuthTokenError("token_request_failed", { tokenUrlHost: "idp" })],
    ["a plain error", new Error("boom")],
  ])("passes %s through unchanged, so callers can still branch on it", (_, error) => {
    expect(redactAIError(error)).toBe(error);
  });

  // A provider's streamed error can reach a caller as a plain object holding the provider's message, and
  // a whole-error sink would log every field of it. Nothing that is not an Error is let through.
  test.each([
    ["a string", PLANTED_USER_CONTENT],
    ["a provider's error object", { error: { message: PLANTED_USER_CONTENT, code: "invalid_request" } }],
    ["undefined", undefined],
    ["null", null],
  ])("replaces %s with an error naming only its type", (_, thrown) => {
    const redacted = redactAIError(thrown);

    expect(redacted).toBeInstanceOf(RedactedAIError);
    expect(redacted).toMatchObject({ originalName: typeof thrown });
    expect(findPlantedContent(redacted)).toBeUndefined();
  });

  test("keeps the provider status of an AI SDK error wrapped under an app error", () => {
    const wrapped = new Error("Translation failed", { cause: buildProviderCallError(503) });

    const redacted = redactAIError(wrapped) as RedactedAIError;

    expect(redacted).toMatchObject({ originalName: "Error", providerStatusCode: 503 });
    expect(redacted.message).toContain("(provider status 503)");
  });
});

describe("isAISDKErrorChain", () => {
  test("stops on a cause cycle instead of looping", () => {
    const error = new Error("loop");
    error.cause = error;

    expect(isAISDKErrorChain(error)).toBe(false);
  });

  test("finds an AI SDK error under a cause", () => {
    expect(isAISDKErrorChain(new Error("wrapped", { cause: buildNoObjectError() }))).toBe(true);
  });
});
