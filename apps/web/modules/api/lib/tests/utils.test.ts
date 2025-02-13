import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
import { formatZodError, handleApiError } from "../utils";

describe("utils", () => {
  describe("handleApiError", () => {
    test('return bad request response for "bad_request" error', async () => {
      const details = [{ field: "param", issue: "invalid" }];
      const error: ApiErrorResponse = { type: "bad_request", details };

      const response = handleApiError(error);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe(400);
      expect(body.error.message).toBe("Bad Request");
      expect(body.error.details).toEqual(details);
    });

    test('return unauthorized response for "unauthorized" error', async () => {
      const error: ApiErrorResponse = { type: "unauthorized" };
      const response = handleApiError(error);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe(401);
      expect(body.error.message).toBe("Unauthorized");
    });

    test('return forbidden response for "forbidden" error', async () => {
      const error: ApiErrorResponse = { type: "forbidden" };
      const response = handleApiError(error);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe(403);
      expect(body.error.message).toBe("Forbidden");
    });

    test('return not found response for "not_found" error', async () => {
      const details = [{ field: "resource", issue: "not found" }];
      const error: ApiErrorResponse = { type: "not_found", details };

      const response = handleApiError(error);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe(404);
      expect(body.error.message).toBe("Not Found");
      expect(body.error.details).toEqual(details);
    });

    test('return conflict response for "conflict" error', async () => {
      const error: ApiErrorResponse = { type: "conflict" };
      const response = handleApiError(error);
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe(409);
      expect(body.error.message).toBe("Conflict");
    });

    test('return unprocessable entity response for "unprocessable_entity" error', async () => {
      const details = [{ field: "data", issue: "malformed" }];
      const error: ApiErrorResponse = { type: "unprocessable_entity", details };

      const response = handleApiError(error);
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe(422);
      expect(body.error.message).toBe("Unprocessable Entity");
      expect(body.error.details).toEqual(details);
    });

    test('return too many requests response for "too_many_requests" error', async () => {
      const error: ApiErrorResponse = { type: "too_many_requests" };
      const response = handleApiError(error);
      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error.code).toBe(429);
      expect(body.error.message).toBe("Too Many Requests");
    });

    test('return internal server error response for "internal_server_error" error', async () => {
      const details = [{ field: "server", issue: "error occurred" }];
      const error: ApiErrorResponse = { type: "internal_server_error", details };

      const response = handleApiError(error);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.code).toBe(500);
      expect(body.error.message).toBe("Internal Server Error");
      expect(body.error.details).toEqual(details);
    });
  });

  describe("formatZodError", () => {
    test("correctly format a Zod error", () => {
      const zodError = {
        issues: [
          {
            path: ["field1"],
            message: "Invalid value for field1",
          },
          {
            path: ["field2", "subfield"],
            message: "Field2 subfield is required",
          },
        ],
      } as ZodError;

      const formatted = formatZodError(zodError);
      expect(formatted).toEqual([
        { field: "field1", issue: "Invalid value for field1" },
        { field: "field2.subfield", issue: "Field2 subfield is required" },
      ]);
    });

    test("return an empty array if there are no issues", () => {
      const zodError = { issues: [] } as unknown as ZodError;
      const formatted = formatZodError(zodError);
      expect(formatted).toEqual([]);
    });
  });
});
