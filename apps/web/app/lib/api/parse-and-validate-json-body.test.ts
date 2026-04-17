import { describe, expect, test } from "vitest";
import { z } from "zod";
import { parseAndValidateJsonBody } from "./parse-and-validate-json-body";

describe("parseAndValidateJsonBody", () => {
  test("returns a malformed JSON response when request parsing fails", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{invalid-json",
    });

    const result = await parseAndValidateJsonBody({
      request,
      schema: z.object({
        finished: z.boolean(),
      }),
      malformedJsonMessage: "Malformed JSON in request body",
    });

    expect("response" in result).toBe(true);

    if (!("response" in result)) {
      throw new Error("Expected a response result");
    }

    expect(result.issue).toBe("invalid_json");
    expect(result.details).toEqual({
      error: expect.any(String),
    });
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Malformed JSON in request body",
      details: {
        error: expect.any(String),
      },
    });
  });

  test("returns a validation response when the parsed JSON does not match the schema", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        finished: "not-boolean",
      }),
    });

    const result = await parseAndValidateJsonBody({
      request,
      schema: z.object({
        finished: z.boolean(),
      }),
    });

    expect("response" in result).toBe(true);

    if (!("response" in result)) {
      throw new Error("Expected a response result");
    }

    expect(result.issue).toBe("invalid_body");
    expect(result.details).toEqual(
      expect.objectContaining({
        finished: expect.any(String),
      })
    );
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Fields are missing or incorrectly formatted",
      details: expect.objectContaining({
        finished: expect.any(String),
      }),
    });
  });

  test("returns parsed data when JSON parsing and schema validation succeed", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        finished: true,
      }),
    });

    const result = await parseAndValidateJsonBody({
      request,
      schema: z.object({
        finished: z.boolean(),
        environmentId: z.string(),
      }),
      buildInput: (jsonInput) => ({
        ...(jsonInput as Record<string, unknown>),
        environmentId: "env_123",
      }),
    });

    expect(result).toEqual({
      data: {
        environmentId: "env_123",
        finished: true,
      },
    });
  });
});
