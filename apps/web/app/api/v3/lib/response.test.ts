import { describe, expect, test } from "vitest";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  problemNotFound,
  problemTooManyRequests,
  problemUnauthorized,
  successListResponse,
} from "./response";

describe("v3 problem responses", () => {
  test("problemBadRequest includes invalid_params", async () => {
    const res = problemBadRequest("rid", "bad", {
      invalid_params: [{ name: "x", reason: "y" }],
      instance: "/p",
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("X-Request-Id")).toBe("rid");
    const body = await res.json();
    expect(body.code).toBe("bad_request");
    expect(body.requestId).toBe("rid");
    expect(body.invalid_params).toEqual([{ name: "x", reason: "y" }]);
    expect(body.instance).toBe("/p");
  });

  test("problemUnauthorized default detail", async () => {
    const res = problemUnauthorized("r1");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.detail).toBe("Not authenticated");
    expect(body.code).toBe("not_authenticated");
  });

  test("problemForbidden", async () => {
    const res = problemForbidden("r2", undefined, "/api/x");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("forbidden");
    expect(body.instance).toBe("/api/x");
  });

  test("problemInternalError", async () => {
    const res = problemInternalError("r3", "oops", "/i");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("internal_server_error");
    expect(body.detail).toBe("oops");
  });

  test("problemNotFound includes details", async () => {
    const res = problemNotFound("r4", "Survey", "s1", "/s");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("not_found");
    expect(body.details).toEqual({ resource_type: "Survey", resource_id: "s1" });
  });

  test("problemTooManyRequests with Retry-After", async () => {
    const res = problemTooManyRequests("r5", "slow down", 60);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = await res.json();
    expect(body.code).toBe("too_many_requests");
  });

  test("problemTooManyRequests without Retry-After", async () => {
    const res = problemTooManyRequests("r6", "nope");
    expect(res.headers.get("Retry-After")).toBeNull();
  });
});

describe("successListResponse", () => {
  test("sets X-Request-Id and default cache", async () => {
    const res = successListResponse(
      [{ a: 1 }],
      { limit: 10, nextCursor: "cursor-1" },
      {
        requestId: "req-x",
      }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBe("req-x");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(await res.json()).toEqual({
      data: [{ a: 1 }],
      meta: { limit: 10, nextCursor: "cursor-1" },
    });
  });

  test("custom Cache-Control", async () => {
    const res = successListResponse([], { limit: 5, nextCursor: null }, { cache: "private, max-age=0" });
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=0");
  });
});
