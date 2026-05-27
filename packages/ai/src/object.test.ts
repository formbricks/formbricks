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

describe("packages/ai object helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiModel.mockReturnValue({ providerName: "google", modelName: "gemini-2.5-flash" });
    mocks.outputObject.mockImplementation(({ schema }: { schema: unknown }) => ({
      __outputSpec: "object",
      schema,
    }));
  });

  test("uses the configured provider model when generating a structured object", async () => {
    const environment = {
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
    };
    // The schema is opaque to the wrapper — it's passed through to Output.object
    // and never validated by us. A sentinel object is enough for the assertions
    // and avoids dragging zod into this package's deps just for the test.
    const schema = { __schema: "sentinel" } as never;
    mocks.generateText.mockResolvedValue({ output: { answer: "42" } });

    const result = await generateObject({ schema, prompt: "What is the answer?" }, environment);

    expect(mocks.getAiModel).toHaveBeenCalledWith(environment);
    expect(mocks.outputObject).toHaveBeenCalledWith({ schema });
    expect(mocks.generateText).toHaveBeenCalledWith({
      prompt: "What is the answer?",
      model: { providerName: "google", modelName: "gemini-2.5-flash" },
      output: { __outputSpec: "object", schema },
    });
    expect(result.object).toEqual({ answer: "42" });
  });
});
