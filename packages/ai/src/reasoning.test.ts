import "./__mocks__/google-auth";
import { jsonSchema } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateObject } from "./object";
import { resetLanguageModelCache } from "./provider";
import { geminiLowThinkingConfig } from "./reasoning";
import type { AIEnvironment } from "./types";

describe("geminiLowThinkingConfig", () => {
  test.each([
    ["gemini-2.5-flash", { thinkingBudget: 0 }],
    ["gemini-2.5-flash-lite", { thinkingBudget: 0 }],
    // 2.5 Pro cannot turn thinking off; 128 is its least.
    ["gemini-2.5-pro", { thinkingBudget: 128 }],
    ["publishers/google/models/gemini-2.5-pro", { thinkingBudget: 128 }],
    // Every Gemini 3+ level set holds `low`; Pro has no `minimal`.
    ["gemini-3-pro-preview", { thinkingLevel: "low" }],
    ["gemini-3.1-pro", { thinkingLevel: "low" }],
    ["gemini-3.5-flash", { thinkingLevel: "low" }],
    ["Gemini-4-Argon", { thinkingLevel: "low" }],
  ])("%s → %o", (model, expected) => {
    expect(geminiLowThinkingConfig(model)).toEqual(expected);
  });

  test.each(["gemini-2.0-flash", "gemini-1.5-pro", "text-bison", ""])(
    "leaves %o alone: no thinking, or a model it cannot place",
    (model) => {
      expect(geminiLowThinkingConfig(model)).toBeUndefined();
    }
  );
});

const schema = jsonSchema<{ label: string }>({
  type: "object",
  properties: { label: { type: "string" } },
  required: ["label"],
  additionalProperties: false,
});

const google = (model: string): AIEnvironment => ({
  AI_PROVIDER: "google",
  AI_MODEL: model,
  AI_GOOGLE_CLOUD_PROJECT: "test-project",
  AI_GOOGLE_CLOUD_LOCATION: "eu",
});

describe("generateObject: lowReasoning, on the wire", () => {
  const bodies: Record<string, unknown>[] = [];

  beforeEach(() => {
    resetLanguageModelCache();
    bodies.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: unknown, init: { body: string }) => {
        bodies.push(JSON.parse(init.body) as Record<string, unknown>);
        return Response.json({
          candidates: [
            { content: { role: "model", parts: [{ text: '{"label":"x"}' }] }, finishReason: "STOP" },
          ],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const thinkingSent = () =>
    (bodies[0]?.generationConfig as { thinkingConfig?: unknown } | undefined)?.thinkingConfig;

  test("sends Gemini 3+ the `low` thinking level", async () => {
    await generateObject({ prompt: "Label", schema, lowReasoning: true }, google("gemini-3.5-flash"));

    expect(thinkingSent()).toEqual({ thinkingLevel: "low" });
  });

  const safetySettings = [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }];

  test("turns thinking off on Gemini 2.5 Flash, keeping the caller's other Google options", async () => {
    await generateObject(
      { prompt: "Label", schema, lowReasoning: true, providerOptions: { google: { safetySettings } } },
      google("gemini-2.5-flash")
    );

    expect(thinkingSent()).toEqual({ thinkingBudget: 0 });
    expect(bodies[0]?.safetySettings).toEqual(safetySettings);
  });

  test("keeps a caller's own thinking config whole: a budget beside a level is a 400", async () => {
    await generateObject(
      {
        prompt: "Label",
        schema,
        lowReasoning: true,
        providerOptions: { google: { thinkingConfig: { thinkingBudget: 512 } } },
      },
      google("gemini-3.5-flash")
    );

    expect(thinkingSent()).toEqual({ thinkingBudget: 512 });
  });

  test("leaves the model's thinking as configured without it", async () => {
    await generateObject({ prompt: "Label", schema }, google("gemini-3.5-flash"));

    expect(thinkingSent()).toBeUndefined();
  });
});
