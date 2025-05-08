import { NextApiResponse } from "next";
import { describe, expect, test } from "vitest";
import { responses } from "./response";

describe("API Response Utilities", () => {
  describe("successResponse", () => {
    test("should return a success response with data", () => {
      const testData = { message: "test" };
      const response = responses.successResponse(testData);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();

      return response.json().then((body) => {
        expect(body).toEqual({ data: testData });
      });
    });

    test("should include CORS headers when cors is true", () => {
      const testData = { message: "test" };
      const response = responses.successResponse(testData, true);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, DELETE, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    });

    test("should use custom cache control header when provided", () => {
      const testData = { message: "test" };
      const customCache = "public, max-age=3600";
      const response = responses.successResponse(testData, false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("badRequestResponse", () => {
    test("should return a bad request response", () => {
      const message = "Invalid input";
      const details = { field: "email" };
      const response = responses.badRequestResponse(message, details);

      expect(response.status).toBe(400);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "bad_request",
          message,
          details,
        });
      });
    });

    test("should handle undefined details", () => {
      const message = "Invalid input";
      const response = responses.badRequestResponse(message);

      expect(response.status).toBe(400);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "bad_request",
          message,
          details: {},
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const message = "Invalid input";
      const customCache = "no-cache";
      const response = responses.badRequestResponse(message, undefined, false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("notFoundResponse", () => {
    test("should return a not found response", () => {
      const resourceType = "User";
      const resourceId = "123";
      const response = responses.notFoundResponse(resourceType, resourceId);

      expect(response.status).toBe(404);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "not_found",
          message: `${resourceType} not found`,
          details: {
            resource_id: resourceId,
            resource_type: resourceType,
          },
        });
      });
    });

    test("should handle null resourceId", () => {
      const resourceType = "User";
      const response = responses.notFoundResponse(resourceType, null);

      expect(response.status).toBe(404);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "not_found",
          message: `${resourceType} not found`,
          details: {
            resource_id: null,
            resource_type: resourceType,
          },
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const resourceType = "User";
      const resourceId = "123";
      const customCache = "no-cache";
      const response = responses.notFoundResponse(resourceType, resourceId, false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("internalServerErrorResponse", () => {
    test("should return an internal server error response", () => {
      const message = "Something went wrong";
      const response = responses.internalServerErrorResponse(message);

      expect(response.status).toBe(500);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "internal_server_error",
          message,
          details: {},
        });
      });
    });

    test("should include CORS headers when cors is true", () => {
      const message = "Something went wrong";
      const response = responses.internalServerErrorResponse(message, true);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, DELETE, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    });

    test("should use custom cache control header when provided", () => {
      const message = "Something went wrong";
      const customCache = "no-cache";
      const response = responses.internalServerErrorResponse(message, false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("goneResponse", () => {
    test("should return a gone response", () => {
      const message = "Resource no longer available";
      const details = { reason: "deleted" };
      const response = responses.goneResponse(message, details);

      expect(response.status).toBe(410);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "gone",
          message,
          details,
        });
      });
    });

    test("should handle undefined details", () => {
      const message = "Resource no longer available";
      const response = responses.goneResponse(message);

      expect(response.status).toBe(410);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "gone",
          message,
          details: {},
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const message = "Resource no longer available";
      const customCache = "no-cache";
      const response = responses.goneResponse(message, undefined, false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("methodNotAllowedResponse", () => {
    test("should return a method not allowed response", () => {
      const mockRes = {
        req: { method: "PUT" },
      } as NextApiResponse;
      const allowedMethods = ["GET", "POST"];
      const response = responses.methodNotAllowedResponse(mockRes, allowedMethods);

      expect(response.status).toBe(405);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "method_not_allowed",
          message: "The HTTP PUT method is not supported by this route.",
          details: {
            allowed_methods: allowedMethods,
          },
        });
      });
    });

    test("should handle missing request method", () => {
      const mockRes = {} as NextApiResponse;
      const allowedMethods = ["GET", "POST"];
      const response = responses.methodNotAllowedResponse(mockRes, allowedMethods);

      expect(response.status).toBe(405);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "method_not_allowed",
          message: "The HTTP undefined method is not supported by this route.",
          details: {
            allowed_methods: allowedMethods,
          },
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const mockRes = {
        req: { method: "PUT" },
      } as NextApiResponse;
      const allowedMethods = ["GET", "POST"];
      const customCache = "no-cache";
      const response = responses.methodNotAllowedResponse(mockRes, allowedMethods, false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("notAuthenticatedResponse", () => {
    test("should return a not authenticated response", () => {
      const response = responses.notAuthenticatedResponse();

      expect(response.status).toBe(401);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "not_authenticated",
          message: "Not authenticated",
          details: {
            "x-Api-Key": "Header not provided or API Key invalid",
          },
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const customCache = "no-cache";
      const response = responses.notAuthenticatedResponse(false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("unauthorizedResponse", () => {
    test("should return an unauthorized response", () => {
      const response = responses.unauthorizedResponse();

      expect(response.status).toBe(401);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "unauthorized",
          message: "You are not authorized to access this resource",
          details: {},
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const customCache = "no-cache";
      const response = responses.unauthorizedResponse(false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("forbiddenResponse", () => {
    test("should return a forbidden response", () => {
      const message = "Access denied";
      const details = { reason: "insufficient_permissions" };
      const response = responses.forbiddenResponse(message, false, details);

      expect(response.status).toBe(403);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "forbidden",
          message,
          details,
        });
      });
    });

    test("should handle undefined details", () => {
      const message = "Access denied";
      const response = responses.forbiddenResponse(message);

      expect(response.status).toBe(403);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "forbidden",
          message,
          details: {},
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const message = "Access denied";
      const customCache = "no-cache";
      const response = responses.forbiddenResponse(message, false, undefined, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });

  describe("tooManyRequestsResponse", () => {
    test("should return a too many requests response", () => {
      const message = "Rate limit exceeded";
      const response = responses.tooManyRequestsResponse(message);

      expect(response.status).toBe(429);

      return response.json().then((body) => {
        expect(body).toEqual({
          code: "too_many_requests",
          message,
          details: {},
        });
      });
    });

    test("should use custom cache control header when provided", () => {
      const message = "Rate limit exceeded";
      const customCache = "no-cache";
      const response = responses.tooManyRequestsResponse(message, false, customCache);

      expect(response.headers.get("Cache-Control")).toBe(customCache);
    });
  });
});
