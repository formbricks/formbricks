import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { WorkflowConflictError, isUniqueConstraintViolation, toProblemResponse } from "./errors";
import type { WorkflowsLogger } from "./services/ports";

const makeLogger = (): WorkflowsLogger => ({ warn: vi.fn(), error: vi.fn() });

interface ProblemCtx {
  requestId: string;
  instance: string;
  logger: WorkflowsLogger;
}

const makeCtx = (logger: WorkflowsLogger): ProblemCtx => ({
  requestId: "req_1",
  instance: "https://app.formbricks.com",
  logger,
});

const readJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;

describe("isUniqueConstraintViolation", () => {
  test("matches a P2002-shaped error and nothing else", () => {
    expect(isUniqueConstraintViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintViolation(new Error("boom"))).toBe(false);
    expect(isUniqueConstraintViolation({ code: "P2003" })).toBe(false);
    expect(isUniqueConstraintViolation(null)).toBe(false);
    expect(isUniqueConstraintViolation("P2002")).toBe(false);
  });
});

describe("toProblemResponse", () => {
  test("maps a raw Prisma P2002 to a 409 conflict logged as a warning", async () => {
    const logger = makeLogger();
    const error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

    const res = toProblemResponse(error, makeCtx(logger));

    expect(res.status).toBe(409);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    const body = await readJson<{ code: string; detail: string; status: number }>(res);
    expect(body.code).toBe("conflict");
    expect(body.detail).toBe("A workflow with this name already exists.");
    expect(body.status).toBe(409);
    expect(logger.warn).toHaveBeenCalledWith({ statusCode: 409, code: "conflict" }, "Workflow name conflict");
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("maps a ZodError to a 400 with invalid_params", async () => {
    const logger = makeLogger();
    const parsed = z.string().safeParse(123);
    if (parsed.success) throw new Error("expected the parse to fail");

    const res = toProblemResponse(parsed.error, makeCtx(logger));

    expect(res.status).toBe(400);
    const body = await readJson<{ code: string; invalid_params: unknown[] }>(res);
    expect(body.code).toBe("bad_request");
    expect(Array.isArray(body.invalid_params)).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  test("uses a known WorkflowApiError's own status and message", async () => {
    const logger = makeLogger();

    const res = toProblemResponse(new WorkflowConflictError("Custom conflict"), makeCtx(logger));

    expect(res.status).toBe(409);
    const body = await readJson<{ code: string; detail: string }>(res);
    expect(body.code).toBe("conflict");
    expect(body.detail).toBe("Custom conflict");
    expect(logger.warn).toHaveBeenCalled();
  });

  test("falls through to a generic 500 for an unmapped error, logged as an error", async () => {
    const logger = makeLogger();

    const res = toProblemResponse(new Error("kaboom"), makeCtx(logger));

    expect(res.status).toBe(500);
    const body = await readJson<{ code: string; detail: string }>(res);
    expect(body.code).toBe("internal_server_error");
    expect(body.detail).toBe("An unexpected error occurred.");
    expect(logger.error).toHaveBeenCalled();
  });
});
