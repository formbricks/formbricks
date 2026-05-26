import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { generateObject } from "./object";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  getAiModel: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: mocks.generateObject,
}));

vi.mock("./provider", () => ({
  getAiModel: mocks.getAiModel,
}));

describe("packages/ai object helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiModel.mockReturnValue({ providerName: "google", modelName: "gemini-2.5-flash" });
  });

  test("uses the configured provider model when generating a structured object", async () => {
    const environment = {
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
    };
    const schema = z.object({ answer: z.string() });
    mocks.generateObject.mockResolvedValue({ object: { answer: "42" } });

    const result = await generateObject({ schema, prompt: "What is the answer?" }, environment);

    expect(mocks.getAiModel).toHaveBeenCalledWith(environment);
    expect(mocks.generateObject).toHaveBeenCalledWith({
      schema,
      prompt: "What is the answer?",
      model: { providerName: "google", modelName: "gemini-2.5-flash" },
    });
    expect(result).toEqual({ object: { answer: "42" } });
  });
});
