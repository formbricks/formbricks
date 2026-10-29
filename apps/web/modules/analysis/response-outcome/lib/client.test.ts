import { describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { buildBatchOutcomeRequest, setOutcomeInBatches } from "./client";

describe("request building", () => {
  test("a batch is scoped by workspace in the query and carries ids and outcome in the body", () => {
    const { url, init } = buildBatchOutcomeRequest("ws 1", ["a", "b"], null);
    expect(url).toBe("/api/v3/responses/batch-outcome?workspaceId=ws+1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ ids: ["a", "b"], outcome: null });
  });
});

describe("setOutcomeInBatches", () => {
  const ids = Array.from({ length: 230 }, (_, index) => `id${index}`);

  test("sends one call per 100 ids and totals what the server updated", async () => {
    const send = vi.fn(async (chunk: string[]) => ({ updated: chunk.length }));
    const result = await setOutcomeInBatches(ids, send);
    expect(send.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 30]);
    expect(result).toEqual({ doneIds: ids, updated: 230 });
  });

  test("a failing batch stops the run and reports which ids were already done", async () => {
    const failure = new V3ApiError({ status: 403, detail: "Forbidden" });
    const send = vi
      .fn<(chunk: string[]) => Promise<{ updated: number }>>()
      .mockResolvedValueOnce({ updated: 100 })
      .mockRejectedValueOnce(failure);
    await expect(setOutcomeInBatches(ids, send)).rejects.toMatchObject({
      cause: failure,
      doneIds: ids.slice(0, 100),
    });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
