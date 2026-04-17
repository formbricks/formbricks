import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateText } from "./text";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getAiModel: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

vi.mock("./provider", () => ({
  getAiModel: mocks.getAiModel,
}));

describe("packages/ai text helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiModel.mockReturnValue({ providerName: "gcp", modelName: "gemini-2.5-flash" });
    mocks.generateText.mockResolvedValue({
      text: "translated text",
    });
  });

  test("uses the configured provider model automatically when generating text", async () => {
    const environment = {
      AI_PROVIDER: "gcp",
      AI_MODEL: "gemini-2.5-flash",
    };

    const result = await generateText(
      {
        system: "Translate text.",
        prompt: "Hello world",
      },
      environment
    );

    expect(mocks.getAiModel).toHaveBeenCalledWith(environment);
    expect(mocks.generateText).toHaveBeenCalledWith({
      system: "Translate text.",
      prompt: "Hello world",
      model: { providerName: "gcp", modelName: "gemini-2.5-flash" },
    });
    expect(result).toEqual({
      text: "translated text",
    });
  });
});
