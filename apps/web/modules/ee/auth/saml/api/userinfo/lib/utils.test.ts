import { responses } from "@/app/lib/api/response";
import { describe, expect, test, vi } from "vitest";
import { extractAuthToken } from "./utils";

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    unauthorizedResponse: vi.fn().mockReturnValue(new Error("Unauthorized")),
  },
}));

describe("extractAuthToken", () => {
  test("extracts token from Authorization header with Bearer prefix", () => {
    const mockRequest = new Request("https://example.com", {
      headers: {
        authorization: "Bearer token123",
      },
    });

    const token = extractAuthToken(mockRequest);
    expect(token).toBe("token123");
  });

  test("extracts token from Authorization header with other prefix", () => {
    const mockRequest = new Request("https://example.com", {
      headers: {
        authorization: "Custom token123",
      },
    });

    const token = extractAuthToken(mockRequest);
    expect(token).toBe("token123");
  });

  test("extracts token from query parameter", () => {
    const mockRequest = new Request("https://example.com?access_token=token123");

    const token = extractAuthToken(mockRequest);
    expect(token).toBe("token123");
  });

  test("prioritizes Authorization header over query parameter", () => {
    const mockRequest = new Request("https://example.com?access_token=queryToken", {
      headers: {
        authorization: "Bearer headerToken",
      },
    });

    const token = extractAuthToken(mockRequest);
    expect(token).toBe("headerToken");
  });

  test("throws unauthorized error when no token is found", () => {
    const mockRequest = new Request("https://example.com");

    expect(() => extractAuthToken(mockRequest)).toThrow("Unauthorized");
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
  });

  test("throws unauthorized error when Authorization header is empty", () => {
    const mockRequest = new Request("https://example.com", {
      headers: {
        authorization: "",
      },
    });

    expect(() => extractAuthToken(mockRequest)).toThrow("Unauthorized");
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
  });

  test("throws unauthorized error when query parameter is empty", () => {
    const mockRequest = new Request("https://example.com?access_token=");

    expect(() => extractAuthToken(mockRequest)).toThrow("Unauthorized");
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
  });

  test("handles Authorization header with only prefix", () => {
    const mockRequest = new Request("https://example.com", {
      headers: {
        authorization: "Bearer ",
      },
    });

    expect(() => extractAuthToken(mockRequest)).toThrow("Unauthorized");
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
  });
});
