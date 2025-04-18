// api.test.ts
import { ApiClient, makeRequest } from "@/lib/common/api";
import type { TEnvironmentState } from "@/types/config";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("api.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------------
  // makeRequest
  // ---------------------------------------------------------------------------------
  describe("makeRequest()", () => {
    test("successful GET request", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { test: "data" } }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await makeRequest<{ test: string }>("https://example.com", "/api/test", "GET");

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/test", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ test: "data" });
      }
    });

    test("successful POST request with data", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { test: "data" } }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await makeRequest<{ test: string }>("https://example.com", "/api/test", "POST", {
        input: "data",
      });

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: "data" }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ test: "data" });
      }
    });

    test("handles network error", async () => {
      const mockError = {
        code: "network_error",
        message: "Something went wrong",
        status: 500,
      };
      mockFetch.mockRejectedValue(mockError);

      const result = await makeRequest<{ test: string }>("https://example.com", "/api/test", "GET");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(mockError.code);
      }
    });

    test("handles non-OK response", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          code: "not_found",
          message: "Resource not found",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await makeRequest<{ test: string }>("https://example.com", "/api/test", "GET");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          code: "network_error",
          status: 404,
          message: "Resource not found",
          url: expect.any(URL) as URL,
        });
      }
    });

    test("handles forbidden response", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({
          code: "forbidden",
          message: "Access forbidden",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await makeRequest<{ test: string }>("https://example.com", "/api/test", "GET");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          code: "forbidden",
          status: 403,
          message: "Access forbidden",
          url: expect.any(URL) as URL,
        });
      }
    });

    test("handles error response with details", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          code: "bad_request",
          message: "Invalid input",
          details: { field: "email", message: "Invalid email format" },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await makeRequest<{ test: string }>("https://example.com", "/api/test", "GET");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          code: "network_error",
          status: 400,
          message: "Invalid input",
          url: expect.any(URL) as URL,
          details: { field: "email", message: "Invalid email format" },
        });
      }
    });

    test("uses debug mode when specified", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { test: "data" } }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await makeRequest<{ test: string }>("https://example.com", "/api/test", "GET", undefined, true);

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/test", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    });
  });

  // ---------------------------------------------------------------------------------
  // ApiClient
  // ---------------------------------------------------------------------------------
  describe("ApiClient", () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient({
        appUrl: "https://example.com",
        environmentId: "env123",
        isDebug: false,
      });
    });

    test("creates or updates user successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            state: {
              expiresAt: new Date("2023-01-01"),
              data: {
                userId: "user123",
                contactId: "contact123",
                segments: ["segment1"],
                displays: [{ surveyId: "survey1", createdAt: new Date() }],
                responses: ["response1"],
                lastDisplayAt: new Date(),
              },
            },
            messages: ["User updated successfully"],
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await apiClient.createOrUpdateUser({
        userId: "user123",
        attributes: { name: "John", age: "30" },
      });

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/v2/client/env123/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "user123",
          attributes: { name: "John", age: "30" },
        }),
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.state.data.userId).toBe("user123");
        expect(result.data.messages).toEqual(["User updated successfully"]);
      }
    });

    test("creates or updates user with error", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          code: "bad_request",
          message: "Invalid user data",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await apiClient.createOrUpdateUser({
        userId: "user123",
        attributes: { name: "John", age: "30" },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("network_error");
        expect(result.error.message).toBe("Invalid user data");
      }
    });

    test("gets environment state successfully", async () => {
      const mockEnvironmentState: TEnvironmentState = {
        expiresAt: new Date("2023-01-01"),
        data: {
          surveys: [],
          actionClasses: [],
          project: {
            id: "project123",
            recontactDays: 30,
            clickOutsideClose: true,
            darkOverlay: false,
            placement: "bottomRight",
            inAppSurveyBranding: true,
            styling: {
              allowStyleOverwrite: true,
            },
          },
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: mockEnvironmentState,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await apiClient.getEnvironmentState();

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/v1/client/env123/environment", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockEnvironmentState);
      }
    });

    test("gets environment state with error", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          code: "not_found",
          message: "Environment not found",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await apiClient.getEnvironmentState();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("network_error");
        expect(result.error.message).toBe("Environment not found");
      }
    });
  });
});
