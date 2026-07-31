import { beforeEach, describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "./errors";
import { generateObject } from "./object";
import type { TGenerateObjectOptions } from "./types";

interface OutputObjectOptions {
  schema: TGenerateObjectOptions["schema"];
  name?: string;
  description?: string;
}

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getAiModel: vi.fn(),
  outputObject: vi.fn((options: OutputObjectOptions) => ({ type: "object-output", ...options })),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: {
    object: mocks.outputObject,
  },
}));

vi.mock("./provider", () => ({
  getAiModel: mocks.getAiModel,
}));

describe("generateObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiModel.mockReturnValue({ provider: "test", modelId: "model" });
  });

  test("calls the AI SDK with the configured model", async () => {
    const schema = { type: "object" } as unknown as TGenerateObjectOptions<{ title: string }>["schema"];
    const generated = {
      output: { title: "Survey" },
      reasoningText: "reasoning",
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      warnings: undefined,
      request: {},
      response: {},
      providerMetadata: undefined,
    };
    mocks.generateText.mockResolvedValueOnce(generated);

    const result = await generateObject<{ title: string }>(
      {
        schema,
        schemaName: "survey",
        schemaDescription: "A generated survey",
        prompt: "Generate a survey",
      },
      {
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: "us-central1",
      }
    );

    expect(mocks.getAiModel).toHaveBeenCalledWith({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "us-central1",
    });
    expect(mocks.outputObject).toHaveBeenCalledWith({
      schema,
      name: "survey",
      description: "A generated survey",
    });
    expect(mocks.generateText).toHaveBeenCalledWith({
      prompt: "Generate a survey",
      model: { provider: "test", modelId: "model" },
      output: {
        type: "object-output",
        schema,
        name: "survey",
        description: "A generated survey",
      },
    });
    expect(result).toMatchObject({
      object: generated.output,
      reasoning: generated.reasoningText,
      finishReason: generated.finishReason,
      usage: generated.usage,
      warnings: generated.warnings,
      request: generated.request,
      response: generated.response,
      providerMetadata: generated.providerMetadata,
    });
    const response = result.toJsonResponse();

    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    await expect(response.json()).resolves.toEqual(generated.output);
  });

  test("throws AIOutputTokenLimitError when the generation stops at the output token limit", async () => {
    const schema = { type: "object" } as unknown as TGenerateObjectOptions<{ title: string }>["schema"];
    mocks.generateText.mockResolvedValueOnce({
      finishReason: "length",
      usage: {
        inputTokens: 1200,
        outputTokens: 3000,
        totalTokens: 4200,
        outputTokenDetails: { textTokens: 336, reasoningTokens: 2664 },
      },
      // Mirrors the AI SDK, whose `output` getter throws when the generation did not finish with
      // "stop" — and proves generateObject never reads it on the "length" path.
      get output(): never {
        throw new Error("result.output must not be read when the output token limit was reached");
      },
    });

    const promise = generateObject<{ title: string }>({
      schema,
      prompt: "Generate a survey",
      maxOutputTokens: 3000,
    });

    await expect(promise).rejects.toBeInstanceOf(AIOutputTokenLimitError);
    await expect(promise).rejects.toHaveProperty("details", {
      maxOutputTokens: 3000,
      outputTokens: 3000,
      reasoningTokens: 2664,
    });
  });
});
