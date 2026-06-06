import { describe, expect, test } from "vitest";
import {
  createdResponse,
  noContentResponse,
  problemAIUnavailable,
  problemBadGateway,
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  problemNotFound,
  problemTooManyRequests,
  problemUnauthorized,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "./response";

describe("v3 problem responses", () => {
  test("problemBadRequest includes invalid_params", async () => {
    const res = problemBadRequest("rid", "bad", {
      invalid_params: [{ name: "x", reason: "y", identifier: "canonical-x" }],
      instance: "/p",
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("X-Request-Id")).toBe("rid");
    const body = await res.json();
    expect(body.code).toBe("bad_request");
    expect(body.requestId).toBe("rid");
    expect(body.invalid_params).toEqual([{ name: "x", reason: "y", identifier: "canonical-x" }]);
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

  test("problemAIUnavailable preserves AI error codes", async () => {
    const res = problemAIUnavailable("r-ai", "AI is disabled", "ai_smart_tools_disabled", "/api/ai");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.title).toBe("AI Unavailable");
    expect(body.code).toBe("ai_smart_tools_disabled");
    expect(body.instance).toBe("/api/ai");
  });

  test("problemAIUnavailable returns 503 for instance configuration gaps", async () => {
    const res = problemAIUnavailable("r-ai", "AI is not configured", "ai_instance_not_configured");
    expect(res.status).toBe(503);
  });

  test("problemUnprocessableContent includes validation details", async () => {
    const res = problemUnprocessableContent("r-422", "Generated payload is invalid", {
      invalid_params: [{ name: "blocks.0.elements", reason: "At least one element is required" }],
      code: "ai_generated_payload_invalid",
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("ai_generated_payload_invalid");
    expect(body.invalid_params).toEqual([
      { name: "blocks.0.elements", reason: "At least one element is required" },
    ]);
  });

  test("problemBadGateway", async () => {
    const res = problemBadGateway("r-502", "Provider failed");
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("bad_gateway");
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

describe("successResponse", () => {
  test("wraps the payload in a data envelope", async () => {
    const res = successResponse({ id: "survey_1" }, { requestId: "req-success" });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBe("req-success");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(await res.json()).toEqual({
      data: { id: "survey_1" },
    });
  });

  test("allows custom status and cache headers", async () => {
    const res = successResponse(
      { ok: true },
      {
        cache: "private, max-age=60",
        status: 202,
      }
    );
    expect(res.status).toBe(202);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
  });
});

describe("createdResponse", () => {
  test("returns 201 with Location, request id, and data envelope", async () => {
    const res = createdResponse(
      { id: "survey_1" },
      {
        location: "/api/v3/surveys/survey_1",
        requestId: "req-created",
      }
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe("/api/v3/surveys/survey_1");
    expect(res.headers.get("X-Request-Id")).toBe("req-created");
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(await res.json()).toEqual({
      data: { id: "survey_1" },
    });
  });
});

describe("noContentResponse", () => {
  test("returns 204 without a body", async () => {
    const res = noContentResponse({ requestId: "req-empty" });
    expect(res.status).toBe(204);
    expect(res.headers.get("X-Request-Id")).toBe("req-empty");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(await res.text()).toBe("");
  });
});
