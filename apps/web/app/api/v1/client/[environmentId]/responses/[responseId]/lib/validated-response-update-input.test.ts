import { describe, expect, test } from "vitest";
import { getValidatedResponseUpdateInput } from "./validated-response-update-input";

describe("getValidatedResponseUpdateInput", () => {
  test("returns a bad request response for malformed JSON", async () => {
    const request = new Request("http://localhost/api/v1/client/test/responses/response-id", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{invalid-json",
    });

    const result = await getValidatedResponseUpdateInput(request);

    expect("response" in result).toBe(true);

    if (!("response" in result)) {
      throw new Error("Expected a response result");
    }

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "bad_request",
        message: "Malformed JSON in request body",
        details: {
          error: expect.any(String),
        },
      })
    );
  });

  test("returns parsed response update input for valid JSON", async () => {
    const request = new Request("http://localhost/api/v1/client/test/responses/response-id", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        finished: true,
      }),
    });

    const result = await getValidatedResponseUpdateInput(request);

    expect(result).toEqual({
      responseUpdateInput: {
        finished: true,
      },
    });
  });

  test("returns a bad request response for schema-invalid JSON", async () => {
    const request = new Request("http://localhost/api/v1/client/test/responses/response-id", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        finished: "not-boolean",
      }),
    });

    const result = await getValidatedResponseUpdateInput(request);

    expect("response" in result).toBe(true);

    if (!("response" in result)) {
      throw new Error("Expected a response result");
    }

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "bad_request",
        message: "Fields are missing or incorrectly formatted",
        details: expect.objectContaining({
          finished: expect.any(String),
        }),
      })
    );
  });
});
