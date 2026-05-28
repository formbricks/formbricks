import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateObject } from "./object";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  outputObject: vi.fn(),
  getAiModel: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: { object: mocks.outputObject },
}));

vi.mock("./provider", () => ({
  getAiModel: mocks.getAiModel,
}));

describe("generateObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiModel.mockReturnValue({ providerName: "google", modelName: "gemini-2.5-flash" });
    mocks.outputObject.mockImplementation(({ schema }: { schema: unknown }) => ({
      __outputSpec: "object",
      schema,
    }));
  });

  test("calls generateText with the configured model and object output", async () => {
    const environment = {
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
    };
    const schema = { __schema: "sentinel" } as never;
    mocks.generateText.mockResolvedValue({ output: { answer: "42" } });

    const result = await generateObject<{ answer: string }>(
      {
        schema,
        schemaName: "Answer",
        schemaDescription: "A generated answer",
        prompt: "What is the answer?",
      },
      environment
    );

    expect(mocks.getAiModel).toHaveBeenCalledWith(environment);
    expect(mocks.outputObject).toHaveBeenCalledWith({
      schema,
      name: "Answer",
      description: "A generated answer",
    });
    expect(mocks.generateText).toHaveBeenCalledWith({
      prompt: "What is the answer?",
      model: { providerName: "google", modelName: "gemini-2.5-flash" },
      output: { __outputSpec: "object", schema },
    });
    expect(result.object).toEqual({ answer: "42" });
  });
});
