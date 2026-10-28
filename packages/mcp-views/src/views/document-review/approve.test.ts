import { makeReview, toolInput } from "./__mocks__/fixtures";
import { describe, expect, test, vi } from "vitest";
import { approveReview, toToolResult } from "./approve";
import { getReviewedArguments } from "./review";

const applied = {
  structuredContent: {
    data: { dryRun: false, envelope: { updatedAt: "2026-10-28T12:05:00.000Z" }, changes: [{}, {}] },
  },
};

const setup = (reviewOverrides = {}, input: Record<string, unknown> | null = toolInput) => {
  const review = makeReview(reviewOverrides);
  return { review, reviewed: getReviewedArguments(input, review) };
};

describe("approveReview", () => {
  test("pushes exactly the reviewed arguments and reports the write", async () => {
    const callTool = vi.fn().mockResolvedValue(applied);
    const outcome = await approveReview({ callTool, ...setup(), confirmed: false });

    expect(callTool).toHaveBeenCalledOnce();
    expect(callTool).toHaveBeenCalledWith({ name: "push_document", arguments: toolInput });
    expect(outcome).toEqual({ ok: true, updatedAt: "2026-10-28T12:05:00.000Z", changeCount: 2 });
  });

  test("adds confirmDestructive only when the person ticked the box", async () => {
    const callTool = vi.fn().mockResolvedValue(applied);
    await approveReview({ callTool, ...setup({ status: "destructive" }), confirmed: true });
    expect(callTool).toHaveBeenCalledWith({
      name: "push_document",
      arguments: { ...toolInput, confirmDestructive: true },
    });
  });

  test("refuses a destructive change that was not confirmed, without calling the server", async () => {
    const callTool = vi.fn();
    const outcome = await approveReview({ callTool, ...setup({ status: "destructive" }), confirmed: false });
    expect(callTool).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ ok: false, reason: "blocked" });
  });

  test("refuses a push whose document version is not the reviewed one, without calling the server", async () => {
    const callTool = vi.fn();
    const outcome = await approveReview({
      callTool,
      ...setup({}, { ...toolInput, schemaVersion: 2 }),
      confirmed: false,
    });
    expect(callTool).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      ok: false,
      reason: "version",
      title: "This review is for a different document version",
    });
  });

  test.each([
    ["stale", { status: "stale" }],
    ["invalid", { status: "invalid" }],
    ["unchanged", { summary: { total: 0, added: 0, removed: 0, changed: 0, destructive: 0 } }],
  ])("does not push a %s review", async (_name, overrides) => {
    const callTool = vi.fn();
    expect(await approveReview({ callTool, ...setup(overrides), confirmed: true })).toMatchObject({
      ok: false,
      reason: "blocked",
    });
    expect(callTool).not.toHaveBeenCalled();
  });

  test("does not push without the arguments the review was made for", async () => {
    const callTool = vi.fn();
    expect(await approveReview({ callTool, ...setup({}, null), confirmed: false })).toMatchObject({
      ok: false,
      reason: "blocked",
    });
    expect(
      await approveReview({ callTool, ...setup({}, { ...toolInput, id: "x" }), confirmed: false })
    ).toMatchObject({ ok: false, reason: "blocked" });
    expect(callTool).not.toHaveBeenCalled();
  });

  test("a stale refusal from the server is recognised", async () => {
    const callTool = vi.fn().mockResolvedValue({
      isError: true,
      structuredContent: {
        error: { status: 409, title: "Conflict", detail: "Changed.", details: { currentUpdatedAt: "x" } },
      },
    });
    expect(await approveReview({ callTool, ...setup(), confirmed: false })).toMatchObject({
      ok: false,
      reason: "stale",
    });
  });

  test("another refusal, or an answer that wrote nothing, is a failure", async () => {
    const refused = vi.fn().mockResolvedValue({
      isError: true,
      structuredContent: { error: { status: 403, title: "Forbidden", detail: "No." } },
    });
    expect(await approveReview({ callTool: refused, ...setup(), confirmed: false })).toMatchObject({
      ok: false,
      reason: "refused",
      status: 403,
    });

    const dryRun = vi.fn().mockResolvedValue({ structuredContent: { data: { dryRun: true } } });
    expect(await approveReview({ callTool: dryRun, ...setup(), confirmed: false })).toMatchObject({
      ok: false,
      reason: "refused",
    });
  });

  test("a call that throws is an outcome, not an exception", async () => {
    const callTool = vi.fn().mockRejectedValue(new Error("Transport closed"));
    expect(await approveReview({ callTool, ...setup(), confirmed: false })).toMatchObject({
      ok: false,
      reason: "unreachable",
      detail: "Transport closed",
    });

    const silent = vi.fn().mockRejectedValue("nope");
    expect(await approveReview({ callTool: silent, ...setup(), confirmed: false })).toMatchObject({
      ok: false,
      reason: "unreachable",
      detail: "The host could not reach the server.",
    });
  });
});

describe("toToolResult", () => {
  test("keeps the parts of a result the view reads", () => {
    expect(
      toToolResult({
        content: [{ type: "text", text: "hi" }, { type: "image" }, "x", { text: 1 }],
        structuredContent: { data: 1 },
        isError: true,
        _meta: { other: true },
      })
    ).toEqual({
      content: [{ type: "text", text: "hi" }, { type: "image" }],
      structuredContent: { data: 1 },
      isError: true,
    });
  });

  test("reads anything else as an empty result", () => {
    expect(toToolResult(null)).toEqual({});
    expect(toToolResult("nope")).toEqual({});
    expect(toToolResult({ content: "x", structuredContent: [] })).toEqual({});
  });
});
