import { describe, expect, test } from "vitest";
import { responses } from "../response";

describe("API Responses", () => {
  describe("badRequestResponse", () => {
    test("return a 400 response with error details", async () => {
      const details = [{ field: "param", issue: "invalid" }];
      const res = responses.badRequestResponse({ details });
      expect(res.status).toBe(400);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 400,
          message: "Bad Request",
          details,
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.badRequestResponse({ cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("unauthorizedResponse", () => {
    test("return a 401 response with the proper error message", async () => {
      const res = responses.unauthorizedResponse();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 401,
          message: "Unauthorized",
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.unauthorizedResponse({ cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("forbiddenResponse", () => {
    test("return a 403 response", async () => {
      const res = responses.forbiddenResponse();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 403,
          message: "Forbidden",
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.forbiddenResponse({ cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("notFoundResponse", () => {
    test("return a 404 response with error details", async () => {
      const details = [{ field: "resource", issue: "not found" }];
      const res = responses.notFoundResponse({ details });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 404,
          message: "Not Found",
          details,
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.notFoundResponse({ cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("conflictResponse", () => {
    test("return a 409 response", async () => {
      const details = [{ field: "resource", issue: "already exists" }];
      const res = responses.conflictResponse({ details });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 409,
          message: "Conflict",
          details,
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.conflictResponse({ cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("unprocessableEntityResponse", () => {
    test("return a 422 response with error details", async () => {
      const details = [{ field: "data", issue: "malformed" }];
      const res = responses.unprocessableEntityResponse({ details });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 422,
          message: "Unprocessable Entity",
          details,
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.unprocessableEntityResponse({ cors: true, details: [] });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("tooManyRequestsResponse", () => {
    test("return a 429 response", async () => {
      const res = responses.tooManyRequestsResponse();
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 429,
          message: "Too Many Requests",
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.tooManyRequestsResponse({ cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("internalServerErrorResponse", () => {
    test("return a 500 response with error details", async () => {
      const details = [{ field: "server", issue: "crashed" }];
      const res = responses.internalServerErrorResponse({ details });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 500,
          message: "Internal Server Error",
          details,
        },
      });
    });

    test("include CORS headers when cors is true", () => {
      const res = responses.internalServerErrorResponse({ cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("successResponse", () => {
    test("return a success response with the provided data", async () => {
      const data = { foo: "bar" };
      const meta = { page: 1 };
      const res = responses.successResponse({ data, meta });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual(data);
      expect(body.meta).toEqual(meta);
    });

    test("include CORS headers when cors is true", () => {
      const data = { foo: "bar" };
      const res = responses.successResponse({ data, cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("createdResponse", () => {
    test("return a success response with the provided data", async () => {
      const data = { foo: "bar" };
      const meta = { page: 1 };
      const res = responses.createdResponse({ data, meta });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data).toEqual(data);
      expect(body.meta).toEqual(meta);
    });

    test("include CORS headers when cors is true", () => {
      const data = { foo: "bar" };
      const res = responses.createdResponse({ data, cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("multiStatusResponse", () => {
    test("return a 207 response with the provided data", async () => {
      const data = { foo: "bar" };
      const res = responses.multiStatusResponse({ data });
      expect(res.status).toBe(207);
      const body = await res.json();
      expect(body.data).toEqual(data);
    });

    test("include CORS headers when cors is true", () => {
      const data = { foo: "bar" };
      const res = responses.multiStatusResponse({ data, cors: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});
