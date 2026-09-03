import { beforeEach, describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "./errors";
import { streamObject } from "./stream-object";
import type { TStreamObjectOptions } from "./types";

interface OutputObjectOptions {
  schema: TStreamObjectOptions["schema"];
  name?: string;
  description?: string;
}

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
  getAiModel: vi.fn(),
  outputObject: vi.fn((options: OutputObjectOptions) => ({ type: "object-output", ...options })),
}));

vi.mock("ai", () => ({
  streamText: mocks.streamText,
  Output: {
    object: mocks.outputObject,
  },
}));

vi.mock("./provider", () => ({
  getAiModel: mocks.getAiModel,
}));

const schema = { type: "object" } as unknown as TStreamObjectOptions<{ title: string }>["schema"];

/**
 * Stands in for the SDK's StreamTextResult, recording the order in which the caller touches its
 * members. The real object tees `baseStream` on every promise-like getter, so read order is a
 * correctness concern rather than a style one.
 */
const createStreamResult = (
  overrides: Partial<{ finishReason: string; usage: unknown; output: unknown }> = {}
) => {
  const accessOrder: string[] = [];
  const partialOutputStream = Symbol("partialOutputStream");

  const result = {
    accessOrder,
    partialOutputStreamToken: partialOutputStream,
    get partialOutputStream() {
      accessOrder.push("partialOutputStream");
      return partialOutputStream;
    },
    get finishReason() {
      accessOrder.push("finishReason");
      return Promise.resolve(overrides.finishReason ?? "stop");
    },
    get usage() {
      accessOrder.push("usage");
      return Promise.resolve(
        overrides.usage ?? { inputTokens: 10, outputTokens: 20, outputTokenDetails: {} }
      );
    },
    get output() {
      accessOrder.push("output");
      return Promise.resolve(overrides.output ?? { title: "Survey" });
    },
  };

  return result;
};

describe("streamObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiModel.mockReturnValue({ provider: "test", modelId: "model" });
  });

  test("calls the AI SDK with the configured model and an object output", () => {
    mocks.streamText.mockReturnValueOnce(createStreamResult());

    streamObject<{ title: string }>(
      { schema, schemaName: "survey", schemaDescription: "A generated survey", prompt: "Generate" },
      { AI_PROVIDER: "google", AI_MODEL: "gemini-2.5-flash" }
    );

    expect(mocks.getAiModel).toHaveBeenCalledWith({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
    });
    expect(mocks.outputObject).toHaveBeenCalledWith({
      schema,
      name: "survey",
      description: "A generated survey",
    });
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Generate",
        model: { provider: "test", modelId: "model" },
        output: { type: "object-output", schema, name: "survey", description: "A generated survey" },
      })
    );
  });

  test("applies wrapModel to the resolved model", () => {
    mocks.streamText.mockReturnValueOnce(createStreamResult());
    const wrapped = { provider: "wrapped", modelId: "model" };

    streamObject({ schema, prompt: "Generate" }, undefined, () => wrapped as never);

    expect(mocks.streamText).toHaveBeenCalledWith(expect.objectContaining({ model: wrapped }));
  });

  test("reads partialOutputStream before touching any promise getter", () => {
    // The SDK's teeStream() reassigns baseStream, and every promise getter drains through
    // finalStep, so a partial stream captured after them silently loses chunks.
    const streamResult = createStreamResult();
    mocks.streamText.mockReturnValueOnce(streamResult);

    const result = streamObject({ schema, prompt: "Generate" });

    expect(streamResult.accessOrder[0]).toBe("partialOutputStream");
    expect(streamResult.accessOrder.filter((entry) => entry === "partialOutputStream")).toHaveLength(1);
    expect(result.partialObjectStream).toBe(streamResult.partialOutputStreamToken);
  });

  test("completion resolves with the parsed output", async () => {
    mocks.streamText.mockReturnValueOnce(createStreamResult({ output: { title: "Onboarding" } }));

    const result = streamObject<{ title: string }>({ schema, prompt: "Generate" });

    await expect(result.completion).resolves.toEqual({ title: "Onboarding" });
  });

  test("completion rejects with AIOutputTokenLimitError when the model hit the token limit", async () => {
    mocks.streamText.mockReturnValueOnce(
      createStreamResult({
        finishReason: "length",
        usage: { inputTokens: 10, outputTokens: 8192, outputTokenDetails: { reasoningTokens: 128 } },
      })
    );

    const result = streamObject({ schema, prompt: "Generate", maxOutputTokens: 8192 });

    await expect(result.completion).rejects.toBeInstanceOf(AIOutputTokenLimitError);
    await result.completion.catch((error: AIOutputTokenLimitError) => {
      expect(error.details).toEqual({
        maxOutputTokens: 8192,
        outputTokens: 8192,
        reasoningTokens: 128,
      });
    });
  });

  test("completion rejects with the error handed to onError, not the finishReason rejection", async () => {
    // A provider 429 only ever reaches user code through onError; finishReason rejects with a bare
    // NoOutputGeneratedError that carries no status code, so classification off it always misses.
    const providerError = new Error("provider returned 429");
    mocks.streamText.mockImplementationOnce((request: { onError: (e: { error: unknown }) => void }) => {
      void request.onError({ error: providerError });
      return {
        get partialOutputStream() {
          return Symbol("partialOutputStream");
        },
        get finishReason() {
          return Promise.reject(new Error("No output generated"));
        },
        get usage() {
          return Promise.resolve({ outputTokens: 0, outputTokenDetails: {} });
        },
        get output() {
          return Promise.reject(new Error("No output generated"));
        },
      };
    });

    const result = streamObject({ schema, prompt: "Generate" });

    await expect(result.completion).rejects.toBe(providerError);
  });

  test("forwards onError to the caller's handler", () => {
    const callerOnError = vi.fn();
    const providerError = new Error("boom");
    mocks.streamText.mockImplementationOnce((request: { onError: (e: { error: unknown }) => void }) => {
      void request.onError({ error: providerError });
      return createStreamResult();
    });

    streamObject({ schema, prompt: "Generate", onError: callerOnError });

    expect(callerOnError).toHaveBeenCalledWith({ error: providerError });
  });
});
