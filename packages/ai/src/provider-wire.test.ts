import "./__mocks__/google-auth";
import { jsonSchema, stepCountIs, tool } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "./errors";
import { generateObject } from "./object";
import { resetLanguageModelCache } from "./provider";
import { streamObject } from "./stream-object";
import { generateText } from "./text";
import type { AIEnvironment, TGenerateTextOptions } from "./types";

const google: AIEnvironment = {
  AI_PROVIDER: "google",
  AI_MODEL: "gemini-3.5-flash",
  AI_GOOGLE_CLOUD_PROJECT: "test-project",
  AI_GOOGLE_CLOUD_LOCATION: "eu",
};
const compatible: AIEnvironment = {
  AI_PROVIDER: "openai-compatible",
  AI_MODEL: "custom-model",
  AI_OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1",
  AI_OPENAI_COMPATIBLE_API_KEY: "test-key",
  AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS: "1",
};
const schema = jsonSchema<{ label: string }>({
  type: "object",
  properties: { label: { type: "string" } },
  required: ["label"],
  additionalProperties: false,
});
const output = '{"label":"Product"}';

const googleResponse = (text: string, finishReason = "STOP") => ({
  candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 7,
    totalTokenCount: 22,
  },
});
const compatibleResponse = (text: string, streaming: boolean) => ({
  id: "test-completion",
  object: streaming ? "chat.completion.chunk" : "chat.completion",
  created: 1,
  model: "custom-model",
  choices: [
    {
      index: 0,
      ...(streaming ? { delta: { content: text } } : { message: { role: "assistant", content: text } }),
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

describe("provider HTTP contracts", () => {
  const requests: Request[] = [];
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetLanguageModelCache();
    requests.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each([
    ["google", google],
    ["openai-compatible", compatible],
  ] as const)(
    "%s preserves generation settings for text, objects and streams",
    async (provider, environment) => {
      fetchMock.mockImplementation(async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        const body = (await request.clone().json()) as { stream?: boolean };
        const streaming = request.url.includes(":streamGenerateContent") || body.stream === true;
        const response =
          provider === "google" ? googleResponse(output) : compatibleResponse(output, streaming);
        return streaming
          ? new Response(
              `data: ${JSON.stringify(response)}\n\n${provider === "google" ? "" : "data: [DONE]\n\n"}`,
              {
                headers: { "content-type": "text/event-stream" },
              }
            )
          : Response.json(response);
      });

      const providerOptions: TGenerateTextOptions["providerOptions"] =
        provider === "google"
          ? { google: { thinkingConfig: { thinkingLevel: "medium" } } }
          : { openaiCompatible: { top_k: 20 } };
      const options = {
        prompt: "Label this cluster",
        temperature: 0,
        topP: 0.8,
        maxOutputTokens: 1200,
        maxRetries: 0,
        providerOptions,
        ...(provider === "google" ? { topK: 20 } : {}),
      };
      expect((await generateText(options, environment)).text).toBe(output);
      const result = await generateObject({ ...options, schema }, environment);
      expect(result.object).toEqual({ label: "Product" });
      const streamed = streamObject({ ...options, schema }, environment);
      const partials = [];
      for await (const partial of streamed.partialObjectStream) {
        partials.push(partial);
      }
      expect(partials.at(-1)).toEqual({ label: "Product" });
      await expect(streamed.completion).resolves.toEqual({ label: "Product" });
      expect(requests).toHaveLength(3);

      for (const [index, request] of requests.entries()) {
        const body: unknown = await request.json();
        if (provider === "google") {
          expect(request.headers.get("authorization")).toBe("Bearer test-token");
          expect(request.url).toContain(
            "https://aiplatform.eu.rep.googleapis.com/v1/projects/test-project/locations/eu/publishers/google/models/gemini-3.5-flash:"
          );
          expect(body).toMatchObject({
            generationConfig: {
              temperature: 0,
              topP: 0.8,
              topK: 20,
              maxOutputTokens: 1200,
              thinkingConfig: { thinkingLevel: "medium" },
              ...(index > 0
                ? { responseMimeType: "application/json", responseSchema: { required: ["label"] } }
                : {}),
            },
          });
        } else {
          expect(request.url).toBe("https://llm.example.test/v1/chat/completions");
          expect(body).toMatchObject({
            model: "custom-model",
            temperature: 0,
            top_p: 0.8,
            top_k: 20,
            max_tokens: 1200,
            ...(index > 0
              ? { response_format: { type: "json_schema", json_schema: { schema: { required: ["label"] } } } }
              : {}),
          });
        }
      }
      if (provider === "google") {
        expect(result.usage.outputTokens).toBe(12);
        expect(result.usage.outputTokenDetails.reasoningTokens).toBe(7);
      }
    }
  );

  test("Gemini defaults are left to the selected model when callers omit provider options", async () => {
    fetchMock.mockResolvedValue(Response.json(googleResponse(output)));
    await generateText({ prompt: "Label this cluster", temperature: 0 }, google);
    const [input, init] = fetchMock.mock.calls[0];
    const body = (await new Request(input, init).json()) as { generationConfig: Record<string, unknown> };
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  test("Gemini tool results retain the SDK thought signature on the next turn", async () => {
    const signature = "dGVzdC1zaWduYXR1cmU=";
    fetchMock.mockImplementation((input, init) => {
      requests.push(new Request(input, init));
      return Promise.resolve(
        Response.json(
          requests.length === 1
            ? {
                candidates: [
                  {
                    content: {
                      role: "model",
                      parts: [{ functionCall: { name: "lookup", args: {} }, thoughtSignature: signature }],
                    },
                    finishReason: "STOP",
                  },
                ],
              }
            : googleResponse("Done")
        )
      );
    });
    const result = await generateText(
      {
        prompt: "Look up the product label",
        stopWhen: stepCountIs(2),
        tools: {
          lookup: tool({
            inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
            execute: () => ({ label: "Product" }),
          }),
        },
      },
      google
    );
    expect(result.text).toBe("Done");
    expect(requests).toHaveLength(2);
    const body = (await requests[1].json()) as { contents: Array<{ role: string; parts: unknown[] }> };
    expect(body.contents.find((content) => content.role === "model")).toEqual({
      role: "model",
      parts: [{ functionCall: { name: "lookup", args: {} }, thoughtSignature: signature }],
    });
    expect(body.contents.at(-1)?.parts[0]).toHaveProperty("functionResponse.name", "lookup");
  });

  test("Gemini truncation includes reasoning usage in the actionable output-limit error", async () => {
    fetchMock.mockResolvedValue(Response.json(googleResponse('{"label":', "MAX_TOKENS")));
    await expect(
      generateObject({ prompt: "Label", schema, maxOutputTokens: 12 }, google)
    ).rejects.toMatchObject({
      name: AIOutputTokenLimitError.name,
      details: { maxOutputTokens: 12, outputTokens: 12, reasoningTokens: 7 },
    });
  });

  test("Gemini streaming keeps the original quota error available to callers", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } }, { status: 429 })
    );
    const result = streamObject({ prompt: "Label", schema, maxRetries: 0 }, google);
    await expect(result.completion).rejects.toMatchObject({ statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("cancelling a stream aborts the provider request without retrying", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Request cancelled", "AbortError");
    let requestSignal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_input, init) => {
      requestSignal = init?.signal;
      controller.abort(reason);
      return Promise.reject(reason);
    });
    const result = streamObject({ prompt: "Label", schema, abortSignal: controller.signal }, google);
    await expect(result.completion).rejects.toBeDefined();
    expect(requestSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
