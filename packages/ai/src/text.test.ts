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
    mocks.getAiModel.mockReturnValue({ providerName: "google", modelName: "gemini-2.5-flash" });
    mocks.generateText.mockResolvedValue({
      text: "translated text",
    });
  });

  test("uses the configured provider model automatically when generating text", async () => {
    const environment = {
      AI_PROVIDER: "google",
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
      model: { providerName: "google", modelName: "gemini-2.5-flash" },
    });
    expect(result).toEqual({
      text: "translated text",
    });
  });

  test("applies wrapModel to the resolved model when provided", async () => {
    const wrappedModel = { providerName: "google", modelName: "gemini-2.5-flash", wrapped: true };
    const wrapModel = vi.fn().mockReturnValue(wrappedModel);

    await generateText({ system: "Translate text.", prompt: "Hello world" }, undefined, wrapModel);

    expect(wrapModel).toHaveBeenCalledWith({ providerName: "google", modelName: "gemini-2.5-flash" });
    expect(mocks.generateText).toHaveBeenCalledWith({
      system: "Translate text.",
      prompt: "Hello world",
      model: wrappedModel,
    });
  });
});
