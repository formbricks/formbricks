import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { generateObject } from "./object";
import type { AIEnvironment } from "./types";

/**
 * What goes over the wire, through the real AI SDK adapters: a model answer is stubbed at `fetch`, and
 * the request each provider builds is read back.
 */
const answer = (content: string) =>
  new Response(
    JSON.stringify({
      id: "1",
      created: 0,
      model: "m",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { headers: { "content-type": "application/json" } }
  );

const requests: Record<string, unknown>[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
});

const stubModel = (content: string) =>
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: unknown, init: { body: string }) => {
      requests.push(JSON.parse(init.body) as Record<string, unknown>);
      return Promise.resolve(answer(content));
    })
  );

/** A schema with a defaulted field, which a strict JSON schema cannot express. */
const schema = z.object({ title: z.string(), tags: z.array(z.string()).default([]) });

const compatible = (providerName?: string): AIEnvironment => ({
  AI_PROVIDER: "openai-compatible",
  AI_MODEL: "some-model",
  AI_OPENAI_COMPATIBLE_BASE_URL: "https://models.example.com/v1",
  AI_OPENAI_COMPATIBLE_API_KEY: "test-key",
  AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS: "true",
  ...(providerName ? { AI_OPENAI_COMPATIBLE_PROVIDER_NAME: providerName } : {}),
});

const strictOf = () =>
  (requests[0]?.response_format as { json_schema?: { strict?: boolean } } | undefined)?.json_schema?.strict;

describe("generateObject: strictSchema", () => {
  test.each([
    ["the default provider name", undefined],
    ["a configured provider name", "vllm"],
  ])("turns strict decoding off for an OpenAI-compatible provider under %s", async (_label, name) => {
    stubModel('{"title":"Survey"}');

    const result = await generateObject({ schema, prompt: "Plan", strictSchema: false }, compatible(name));

    expect(strictOf()).toBe(false);
    // The answer is still validated against the schema, its default applied.
    expect(result.object).toEqual({ title: "Survey", tags: [] });
  });

  test("turns strict decoding off for Azure OpenAI", async () => {
    stubModel('{"title":"Survey"}');

    // Only the request matters here: the stub answers in Chat Completions' shape.
    await generateObject(
      { schema, prompt: "Plan", strictSchema: false },
      {
        AI_PROVIDER: "azure",
        AI_MODEL: "gpt-x",
        AI_AZURE_API_KEY: "test-key",
        AI_AZURE_BASE_URL: "https://example.openai.azure.com/openai",
      }
    ).catch(() => undefined);

    // Azure speaks the Responses API (`text.format`) or Chat Completions (`response_format.json_schema`).
    const responses = (requests[0]?.text as { format?: { strict?: boolean } } | undefined)?.format?.strict;
    expect(responses ?? strictOf()).toBe(false);
  });

  test("keeps the caller's OpenAI options for Azure, which reads them when it has none of its own", async () => {
    stubModel('{"title":"Survey"}');

    await generateObject(
      { schema, prompt: "Plan", strictSchema: false, providerOptions: { openai: { store: false } } },
      {
        AI_PROVIDER: "azure",
        AI_MODEL: "gpt-x",
        AI_AZURE_API_KEY: "test-key",
        AI_AZURE_BASE_URL: "https://example.openai.azure.com/openai",
      }
    ).catch(() => undefined);

    expect(requests[0]?.store).toBe(false);
  });

  test("leaves a provider's own strict decoding alone by default", async () => {
    stubModel('{"title":"Survey","tags":[]}');

    await generateObject({ schema, prompt: "Plan" }, compatible());

    expect(strictOf()).toBe(true);
  });
});

describe("generateObject: a provider that cannot decode against the schema", () => {
  const systemOf = () =>
    (requests[0]?.messages as { role: string; content: string }[] | undefined)?.find(
      (message) => message.role === "system"
    )?.content ?? "";

  test("is shown the schema in the system prompt, after the caller's own instructions", async () => {
    stubModel('{"title":"Survey"}');

    await generateObject(
      { schema, system: "Plan the survey.", prompt: "Plan" },
      { ...compatible(), AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS: "false" }
    );

    const system = systemOf();
    expect(system.startsWith("Plan the survey.")).toBe(true);
    expect(system).toContain('"title"');
    expect(system).toContain('"tags"');
  });

  test("is shown the schema after a system prompt given as messages, which it keeps", async () => {
    stubModel('{"title":"Survey"}');

    await generateObject(
      { schema, system: { role: "system", content: "Plan the survey." }, prompt: "Plan" },
      { ...compatible(), AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS: "false" }
    );

    const systems = (requests[0]?.messages as { role: string; content: string }[])
      .filter((message) => message.role === "system")
      .map((message) => message.content);
    expect(systems[0]).toBe("Plan the survey.");
    expect(systems.at(-1)).toContain('"tags"');
  });

  test("is not, when the provider decodes against the schema itself", async () => {
    stubModel('{"title":"Survey"}');

    await generateObject({ schema, system: "Plan the survey.", prompt: "Plan" }, compatible());

    expect(systemOf()).toBe("Plan the survey.");
  });
});
