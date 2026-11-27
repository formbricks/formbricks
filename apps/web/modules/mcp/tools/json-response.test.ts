import { describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { mapJsonResponseBody } from "./json-response";

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "x-request-id": "req_1" } });

describe("mapJsonResponseBody", () => {
  test("rewrites a successful body and keeps the status and headers", async () => {
    const response = await mapJsonResponseBody<{ data: { id: string; name: string } }>(
      jsonResponse({ data: { id: "a", name: "Survey" } }, 201),
      (body) => ({ data: { id: body.data.id } })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("req_1");
    expect(await response.json()).toEqual({ data: { id: "a" } });
  });

  test("hands back an error response without reading it", async () => {
    const original = jsonResponse({ error: "nope" }, 404);
    let called = false;

    const response = await mapJsonResponseBody(original, () => {
      called = true;
      return {};
    });

    expect(response).toBe(original);
    expect(called).toBe(false);
  });

  test("hands back the original when the map returns undefined", async () => {
    const original = jsonResponse({ data: "not a list" });

    expect(await mapJsonResponseBody(original, () => undefined)).toBe(original);
  });

  test("hands back the original when the body does not parse or the map throws", async () => {
    const notJson = new Response("not json", { status: 200 });
    expect(await mapJsonResponseBody(notJson, (body) => body)).toBe(notJson);

    const original = jsonResponse({ data: {} });
    const response = await mapJsonResponseBody(original, () => {
      throw new Error("boom");
    });
    expect(response).toBe(original);
    expect(await response.json()).toEqual({ data: {} });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200 }),
      "MCP response projection failed; returning the unprojected response"
    );
  });
});
