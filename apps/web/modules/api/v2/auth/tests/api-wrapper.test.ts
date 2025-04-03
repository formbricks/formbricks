import { apiWrapper } from "@/modules/api/v2/auth/api-wrapper";
import { authenticateRequest } from "@/modules/api/v2/auth/authenticate-request";
import { checkRateLimitAndThrowError } from "@/modules/api/v2/lib/rate-limit";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { err, ok, okVoid } from "@formbricks/types/error-handlers";

vi.mock("../authenticate-request", () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("@/modules/api/v2/lib/rate-limit", () => ({
  checkRateLimitAndThrowError: vi.fn(),
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: vi.fn(),
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  formatZodError: vi.fn(),
  handleApiError: vi.fn(),
}));

describe("apiWrapper", () => {
  it("should handle request and return response", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );
    vi.mocked(checkRateLimitAndThrowError).mockResolvedValue(okVoid());

    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const response = await apiWrapper({
      request,
      handler,
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it("should handle errors and return error response", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "invalid-api-key" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(err({ type: "unauthorized" }));
    vi.mocked(handleApiError).mockResolvedValue(new Response("error", { status: 401 }));

    const handler = vi.fn();
    const response = await apiWrapper({
      request,
      handler,
    });

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should parse body schema correctly", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );

    const bodySchema = z.object({ key: z.string() });
    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    const response = await apiWrapper({
      request,
      schemas: { body: bodySchema },
      rateLimit: false,
      handler,
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedInput: { body: { key: "value" } },
      })
    );
  });

  it("should handle body schema errors", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ key: 123 }),
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );

    vi.mocked(handleApiError).mockResolvedValue(new Response("error", { status: 400 }));

    const bodySchema = z.object({ key: z.string() });
    const handler = vi.fn();

    const response = await apiWrapper({
      request,
      schemas: { body: bodySchema },
      rateLimit: false,
      handler,
    });

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should parse query schema correctly", async () => {
    const request = new Request("http://localhost?key=value");

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );

    const querySchema = z.object({ key: z.string() });
    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    const response = await apiWrapper({
      request,
      schemas: { query: querySchema },
      rateLimit: false,
      handler,
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedInput: { query: { key: "value" } },
      })
    );
  });

  it("should handle query schema errors", async () => {
    const request = new Request("http://localhost?foo%ZZ=abc");

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );

    vi.mocked(handleApiError).mockResolvedValue(new Response("error", { status: 400 }));

    const querySchema = z.object({ key: z.string() });
    const handler = vi.fn();

    const response = await apiWrapper({
      request,
      schemas: { query: querySchema },
      rateLimit: false,
      handler,
    });

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should parse params schema correctly", async () => {
    const request = new Request("http://localhost");

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );

    const paramsSchema = z.object({ key: z.string() });
    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    const response = await apiWrapper({
      request,
      schemas: { params: paramsSchema },
      externalParams: Promise.resolve({ key: "value" }),
      rateLimit: false,
      handler,
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedInput: { params: { key: "value" } },
      })
    );
  });

  it("should handle no external params", async () => {
    const request = new Request("http://localhost");

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );

    vi.mocked(handleApiError).mockResolvedValue(new Response("error", { status: 400 }));

    const paramsSchema = z.object({ key: z.string() });
    const handler = vi.fn();

    const response = await apiWrapper({
      request,
      schemas: { params: paramsSchema },
      externalParams: undefined,
      rateLimit: false,
      handler,
    });

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle params schema errors", async () => {
    const request = new Request("http://localhost");

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );

    vi.mocked(handleApiError).mockResolvedValue(new Response("error", { status: 400 }));

    const paramsSchema = z.object({ key: z.string() });
    const handler = vi.fn();

    const response = await apiWrapper({
      request,
      schemas: { params: paramsSchema },
      externalParams: Promise.resolve({ notKey: "value" }),
      rateLimit: false,
      handler,
    });

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle rate limit errors", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(
      ok({
        type: "apiKey",
        environmentId: "env-id",
        hashedApiKey: "hashed-api-key",
      })
    );
    vi.mocked(checkRateLimitAndThrowError).mockResolvedValue(
      err({ type: "rateLimitExceeded" } as unknown as ApiErrorResponseV2)
    );
    vi.mocked(handleApiError).mockImplementation(
      (_request: Request, _error: ApiErrorResponseV2): Response =>
        new Response("rate limit exceeded", { status: 429 })
    );

    const handler = vi.fn();
    const response = await apiWrapper({
      request,
      handler,
    });

    expect(response.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });
});
