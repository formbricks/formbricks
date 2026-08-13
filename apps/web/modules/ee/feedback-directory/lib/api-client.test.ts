import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { purgeFeedbackDataset } from "./api-client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const accepted = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 202, headers: { "Content-Type": "application/json" } });

describe("purgeFeedbackDataset", () => {
  test("posts to the dataset's purge route and unwraps the envelope", async () => {
    fetchMock.mockResolvedValue(accepted({ data: { datasetId: "ds_1", status: "accepted" } }));

    await expect(purgeFeedbackDataset("ds_1")).resolves.toEqual({
      datasetId: "ds_1",
      status: "accepted",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/internal/feedback-datasets/ds_1/purge");
    expect(init.method).toBe("POST");
  });

  // A dataset id is a cuid2 today, but the path must not be forgeable if that ever changes — an
  // unescaped segment would address a different route entirely.
  test("escapes the dataset id in the path", async () => {
    fetchMock.mockResolvedValue(accepted({ data: { datasetId: "a/b", status: "accepted" } }));

    await purgeFeedbackDataset("a/b");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/internal/feedback-datasets/a%2Fb/purge");
  });

  test("throws a parsed V3ApiError on a problem response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Only organization owners and managers can purge" }), {
        status: 403,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    await expect(purgeFeedbackDataset("ds_1")).rejects.toBeInstanceOf(V3ApiError);
  });

  // The purge is destructive and irreversible, so a hung request must not sit forever with the
  // dialog spinning.
  test("bounds the request with an abort signal", async () => {
    fetchMock.mockResolvedValue(accepted({ data: { datasetId: "ds_1", status: "accepted" } }));

    await purgeFeedbackDataset("ds_1");

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
