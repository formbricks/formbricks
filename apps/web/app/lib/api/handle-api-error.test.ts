import { describe, expect, test } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  QueryExecutionError,
  ResourceNotFoundError,
  UniqueConstraintError,
  UnknownError,
  ValidationError,
} from "@formbricks/types/errors";
import { GENERIC_API_ERROR_MESSAGE, handleApiError } from "./handle-api-error";

const CORS_HEADER = "Access-Control-Allow-Origin";

describe("handleApiError", () => {
  describe("unexpected / server errors never leak the underlying message", () => {
    const SECRET = "column workspace.secret_column violates constraint fk_secret";

    test.each([
      ["DatabaseError", new DatabaseError(SECRET)],
      ["QueryExecutionError", new QueryExecutionError(SECRET)], // expected-name but statusCode 500
      ["UnknownError", new UnknownError(SECRET)],
      ["plain Error", new Error(SECRET)],
    ])("%s -> generic 500 with the real error threaded back", async (_label, error) => {
      const result = handleApiError(error);

      expect(result.response.status).toBe(500);
      // The real error is threaded so the wrapper's reportApiError logs/Sentry-reports it.
      expect(result.error).toBe(error);

      const body = await result.response.json();
      expect(body.code).toBe("internal_server_error");
      expect(body.message).toBe(GENERIC_API_ERROR_MESSAGE);
      // The raw internal detail must never reach the client.
      expect(JSON.stringify(body)).not.toContain(SECRET);
    });

    test("non-Error values still map to a generic 500 and are threaded back", async () => {
      const result = handleApiError("boom");

      expect(result.response.status).toBe(500);
      expect(result.error).toBe("boom");

      const body = await result.response.json();
      expect(body.message).toBe(GENERIC_API_ERROR_MESSAGE);
    });
  });

  describe("expected client (4xx) errors surface their domain message at the right status", () => {
    test("InvalidInputError -> 400", async () => {
      const result = handleApiError(new InvalidInputError("field 'email' is invalid"));

      expect(result.response.status).toBe(400);
      // Expected 4xx errors are not server errors, so nothing is threaded back for reporting.
      expect(result.error).toBeUndefined();

      const body = await result.response.json();
      expect(body.code).toBe("bad_request");
      expect(body.message).toBe("field 'email' is invalid");
    });

    test("ValidationError -> 400", async () => {
      const result = handleApiError(new ValidationError("bad shape"));
      expect(result.response.status).toBe(400);
      expect((await result.response.json()).message).toBe("bad shape");
    });

    test("UniqueConstraintError -> 409", async () => {
      const result = handleApiError(new UniqueConstraintError("already exists"));

      expect(result.response.status).toBe(409);
      expect(result.error).toBeUndefined();

      const body = await result.response.json();
      expect(body.code).toBe("conflict");
      expect(body.message).toBe("already exists");
    });

    test("ResourceNotFoundError -> 404 with resource details", async () => {
      const result = handleApiError(new ResourceNotFoundError("Survey", "abc123"));

      expect(result.response.status).toBe(404);

      const body = await result.response.json();
      expect(body.code).toBe("not_found");
      expect(body.message).toBe("Survey not found");
      expect(body.details).toEqual({ resource_id: "abc123", resource_type: "Survey" });
    });

    test.each([
      ["AuthorizationError", new AuthorizationError("no access")],
      ["OperationNotAllowedError", new OperationNotAllowedError("no access")],
    ])("%s -> 403", async (_label, error) => {
      const result = handleApiError(error);

      expect(result.response.status).toBe(403);

      const body = await result.response.json();
      expect(body.code).toBe("forbidden");
      expect(body.message).toBe("no access");
    });

    test("AuthenticationError -> 401", async () => {
      const result = handleApiError(new AuthenticationError("nope"));

      expect(result.response.status).toBe(401);
      expect((await result.response.json()).code).toBe("not_authenticated");
    });
  });

  describe("cors option", () => {
    test("omits CORS headers by default", () => {
      const result = handleApiError(new DatabaseError("x"));
      expect(result.response.headers.get(CORS_HEADER)).toBeNull();
    });

    test("adds CORS headers on the 500 path when cors is true", () => {
      const result = handleApiError(new DatabaseError("x"), { cors: true });
      expect(result.response.headers.get(CORS_HEADER)).toBe("*");
    });

    test("adds CORS headers on the 4xx path when cors is true", () => {
      const result = handleApiError(new InvalidInputError("x"), { cors: true });
      expect(result.response.headers.get(CORS_HEADER)).toBe("*");
    });
  });
});
