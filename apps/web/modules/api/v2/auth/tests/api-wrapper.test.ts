import { apiWrapper } from "@/modules/api/v2/auth/api-wrapper";
import { authenticateRequest } from "@/modules/api/v2/auth/authenticate-request";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { checkRateLimit } from "@/modules/core/rate-limit/rate-limit";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { err, ok } from "@formbricks/types/error-handlers";

vi.mock("../authenticate-request", () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    api: {
      v2: { interval: 60, allowedPerInterval: 100, namespace: "api:v2" },
    },
  },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  formatZodError: vi.fn(),
  handleApiError: vi.fn(),
}));

const mockAuthentication = {
  type: "apiKey" as const,
  environmentPermissions: [
    {
      environmentId: "env-id",
      environmentType: "development" as const,
      projectId: "project-id",
      projectName: "Project Name",
      permission: "manage" as const,
    },
  ],
  hashedApiKey: "hashed-api-key",
  apiKeyId: "api-key-id",
  organizationId: "org-id",
  organizationAccess: {} as any,
} as any;

describe("apiWrapper", () => {
  test("should handle request and return response", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));
    vi.mocked(checkRateLimit).mockResolvedValue(ok({ allowed: true }));

    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const response = await apiWrapper({
      request,
      handler,
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  test("should handle errors and return error response", async () => {
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

  test("should parse body schema correctly", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));

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

  test("should handle body schema errors", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ key: 123 }),
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));
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

  test("should parse query schema correctly", async () => {
    const request = new Request("http://localhost?key=value");

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));

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

  test("should handle query schema errors", async () => {
    const request = new Request("http://localhost?foo%ZZ=abc");

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));
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

  test("should parse params schema correctly", async () => {
    const request = new Request("http://localhost");

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));

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

  test("should handle no external params", async () => {
    const request = new Request("http://localhost");

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));
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

  test("should handle params schema errors", async () => {
    const request = new Request("http://localhost");

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));
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

  test("should handle rate limit exceeded", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));
    vi.mocked(checkRateLimit).mockResolvedValue(ok({ allowed: false }));
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

  test("should handle rate limit check failure gracefully", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    vi.mocked(authenticateRequest).mockResolvedValue(ok(mockAuthentication));
    // When rate limiting fails (e.g., Redis connection issues), checkRateLimit fails open by returning allowed: true
    vi.mocked(checkRateLimit).mockResolvedValue(ok({ allowed: true }));

    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const response = await apiWrapper({
      request,
      handler,
    });

    // Should fail open for availability
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });
});
