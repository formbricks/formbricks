import { describe, expect, test, vi } from "vitest";
import { type TApiClient, type TApiResponse } from "./api-client.ts";
import { cleanup } from "./cleanup.ts";
import { CHECK_PREFIX } from "./survey.ts";

const NOW = new Date("2026-10-07T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const reply = (status: number, json?: unknown): TApiResponse => ({
  status,
  ok: status >= 200 && status < 300,
  text: "",
  json,
});

const fakeApi = (handlers: {
  delete?: (path: string) => TApiResponse | Promise<TApiResponse>;
  listed?: unknown;
}) => {
  const remove = vi.fn((path: string) =>
    Promise.resolve(handlers.delete ? handlers.delete(path) : reply(204))
  );
  const get = vi.fn((_path: string) => Promise.resolve(reply(200, { data: handlers.listed ?? [] })));
  return { api: { delete: remove, get } as unknown as TApiClient, remove, get };
};

describe("cleanup", () => {
  test("deletes every recorded survey and reports nothing", async () => {
    const { api, remove } = fakeApi({});

    const problems = await cleanup({ api, surveyIds: ["a", "b"], workspaceId: undefined, now: NOW });

    expect(problems).toEqual([]);
    expect(remove.mock.calls.map(([path]) => path).sort()).toEqual([
      "/api/v3/surveys/a",
      "/api/v3/surveys/b",
    ]);
  });

  test("treats 404 as already deleted", async () => {
    const { api } = fakeApi({ delete: () => reply(404) });

    expect(await cleanup({ api, surveyIds: ["a"], workspaceId: undefined, now: NOW })).toEqual([]);
  });

  test("reports a failed delete and still deletes the rest", async () => {
    const { api, remove } = fakeApi({ delete: (path) => (path.endsWith("/a") ? reply(500) : reply(204)) });

    const problems = await cleanup({ api, surveyIds: ["a", "b"], workspaceId: undefined, now: NOW });

    expect(problems).toEqual(["a: HTTP 500"]);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  test("never throws when the network fails, it reports", async () => {
    const { api } = fakeApi({
      delete: () => {
        throw new Error("connection refused");
      },
    });

    expect(await cleanup({ api, surveyIds: ["a"], workspaceId: undefined, now: NOW })).toEqual([
      "a: connection refused",
    ]);
  });

  test("sweeps only old prefixed surveys and not the ones this run already deleted", async () => {
    const listed = [
      { id: "leftover", name: `${CHECK_PREFIX} old`, createdAt: ago(120) },
      { id: "fresh", name: `${CHECK_PREFIX} new`, createdAt: ago(5) },
      { id: "customer", name: "Customer NPS", createdAt: ago(500) },
      { id: "mine", name: `${CHECK_PREFIX} this run`, createdAt: ago(120) },
    ];
    const { api, remove } = fakeApi({ listed });

    const problems = await cleanup({ api, surveyIds: ["mine"], workspaceId: "ws", now: NOW });

    expect(problems).toEqual([]);
    expect(remove.mock.calls.map(([path]) => path).sort()).toEqual([
      "/api/v3/surveys/leftover",
      "/api/v3/surveys/mine",
    ]);
  });

  test("filters the sweep to the workspace and the prefix", async () => {
    const { api, get } = fakeApi({});

    await cleanup({ api, surveyIds: [], workspaceId: "ws", now: NOW });

    const url = new URL(`http://x${get.mock.calls[0]?.[0] ?? ""}`);
    expect(url.searchParams.get("workspaceId")).toBe("ws");
    expect(url.searchParams.get("filter[name][contains]")).toBe(CHECK_PREFIX);
  });

  test("skips the sweep without a workspace, and reports a failed sweep", async () => {
    const noWorkspace = fakeApi({});
    await cleanup({ api: noWorkspace.api, surveyIds: [], workspaceId: undefined, now: NOW });
    expect(noWorkspace.get).not.toHaveBeenCalled();

    const broken = {
      delete: vi.fn(),
      get: vi.fn().mockRejectedValue(new Error("boom")),
    } as unknown as TApiClient;
    expect(await cleanup({ api: broken, surveyIds: [], workspaceId: "ws", now: NOW })).toEqual([
      "sweep: boom",
    ]);
  });
});
