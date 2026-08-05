import { describe, expect, test } from "vitest";
import { WorkflowInvalidInputError } from "../errors";
import {
  buildNextWorkflowRunListCursor,
  decodeWorkflowRunListCursor,
  encodeWorkflowRunListCursor,
} from "./runs-cursor";

const runId = "cm9zr4w9d000308l8c5n8xk7e";
const createdAt = new Date("2026-06-12T10:00:00.000Z");

describe("runs-cursor", () => {
  test("round-trips a cursor through encode/decode", () => {
    const cursor = buildNextWorkflowRunListCursor({ id: runId, createdAt });
    const decoded = decodeWorkflowRunListCursor(encodeWorkflowRunListCursor(cursor));
    expect(decoded).toEqual({ version: 1, value: "2026-06-12T10:00:00.000Z", id: runId });
  });

  test("buildNext uses the row createdAt ISO string and id", () => {
    expect(buildNextWorkflowRunListCursor({ id: runId, createdAt })).toEqual({
      version: 1,
      value: "2026-06-12T10:00:00.000Z",
      id: runId,
    });
  });

  test("the encoded cursor is an opaque base64url token (no plain query state)", () => {
    const encoded = encodeWorkflowRunListCursor({ version: 1, value: createdAt.toISOString(), id: runId });
    expect(encoded).not.toContain(runId);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("rejects a malformed cursor with a 400 WorkflowInvalidInputError", () => {
    expect(() => decodeWorkflowRunListCursor("not-base64url-json")).toThrow(WorkflowInvalidInputError);
  });

  test("rejects a structurally invalid cursor (missing id)", () => {
    const bad = Buffer.from(JSON.stringify({ version: 1, value: createdAt.toISOString() }), "utf8").toString(
      "base64url"
    );
    expect(() => decodeWorkflowRunListCursor(bad)).toThrow(WorkflowInvalidInputError);
  });

  test("rejects a cursor with a non-ISO value", () => {
    const bad = Buffer.from(JSON.stringify({ version: 1, value: "nope", id: runId }), "utf8").toString(
      "base64url"
    );
    expect(() => decodeWorkflowRunListCursor(bad)).toThrow(WorkflowInvalidInputError);
  });

  test("rejects a cursor from an unknown version", () => {
    const bad = Buffer.from(
      JSON.stringify({ version: 2, value: createdAt.toISOString(), id: runId }),
      "utf8"
    ).toString("base64url");
    expect(() => decodeWorkflowRunListCursor(bad)).toThrow(WorkflowInvalidInputError);
  });
});
