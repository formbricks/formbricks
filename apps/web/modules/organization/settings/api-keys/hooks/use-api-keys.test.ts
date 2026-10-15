/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiKeyKeys } from "../lib/query";
import { useApiKeys, useCreateApiKey, useDeleteApiKey, useUpdateApiKey } from "./use-api-keys";

const ORG_ID = "clorg11111111111111111111";
const LIST_URL = `/api/internal/api-keys?organizationId=${ORG_ID}`;
const keyUrl = (id: string) => `/api/internal/api-keys/${id}`;
const ORG_ACCESS = { accessControl: { read: false, write: false } };

const key = (id: string, label = id) => ({
  id,
  label,
  createdAt: "2026-10-01T10:00:00.000Z",
  organizationAccess: ORG_ACCESS,
  apiKeyWorkspaces: [],
});

const json = (body: unknown, status = 200): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": status < 400 ? "application/json" : "application/problem+json" },
  });

/** Answer `fetch` by method and URL; each route repeats its last answer; an unexpected request fails. */
const routeFetch = (routes: Record<string, Response[]>) =>
  vi.mocked(global.fetch).mockImplementation(async (input, init) => {
    const routeKey = `${init?.method ?? "GET"} ${String(input)}`;
    const answers = routes[routeKey];
    if (!answers) throw new Error(`Unexpected request: ${routeKey}`);
    return (answers.length > 1 ? answers.shift()! : answers[0]).clone();
  });

const setup = (seed?: ReturnType<typeof key>[]) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed) queryClient.setQueryData(apiKeyKeys.list(ORG_ID), seed);
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseApiKeysTestWrapper";
  return { queryClient, wrapper: Wrapper };
};

const cached = (queryClient: QueryClient) => queryClient.getQueryData(apiKeyKeys.list(ORG_ID));

describe("API key hooks", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("lists the organization's keys", async () => {
    routeFetch({ [`GET ${LIST_URL}`]: [json({ data: [key("k1")] })] });
    const { wrapper } = setup();

    const { result } = renderHook(() => useApiKeys(ORG_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([key("k1")]);
  });

  test("adds a minted key to the list without ever caching its plaintext", async () => {
    routeFetch({
      [`POST ${LIST_URL}`]: [json({ data: { ...key("k2"), apiKey: "fbk_plaintext" } }, 201)],
      [`GET ${LIST_URL}`]: [json({ data: [key("k1"), key("k2")] })],
    });
    const { queryClient, wrapper } = setup([key("k1")]);
    const { result } = renderHook(() => useCreateApiKey(ORG_ID), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({ label: "k2", organizationAccess: ORG_ACCESS });
    });

    expect(created).toMatchObject({ id: "k2", apiKey: "fbk_plaintext" });
    await waitFor(() => expect(cached(queryClient)).toEqual([key("k1"), key("k2")]));
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain("fbk_plaintext");
  });

  test("replaces a renamed key with the one the server returns", async () => {
    routeFetch({
      [`PATCH ${keyUrl("k1")}`]: [json({ data: key("k1", "Renamed") })],
      [`GET ${LIST_URL}`]: [json({ data: [key("k1", "Renamed")] })],
    });
    const { queryClient, wrapper } = setup([key("k1"), key("k2")]);
    const { result } = renderHook(() => useUpdateApiKey(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ apiKeyId: "k1", body: { label: "Renamed" } });
    });

    expect(cached(queryClient)).toContainEqual(key("k1", "Renamed"));
  });

  test("removes a deleted key at once and refetches afterwards", async () => {
    routeFetch({
      [`DELETE ${keyUrl("k1")}`]: [json(null, 204)],
      [`GET ${LIST_URL}`]: [json({ data: [key("k2")] })],
    });
    const { queryClient, wrapper } = setup([key("k1"), key("k2")]);
    const { result } = renderHook(() => useDeleteApiKey(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("k1");
    });

    expect(cached(queryClient)).toEqual([key("k2")]);
  });

  test("puts a key back when the server refuses to delete it", async () => {
    routeFetch({
      [`DELETE ${keyUrl("k1")}`]: [json({ status: 403, detail: "Forbidden", code: "forbidden" }, 403)],
      [`GET ${LIST_URL}`]: [json({ data: [key("k1"), key("k2")] })],
    });
    const { queryClient, wrapper } = setup([key("k1"), key("k2")]);
    const { result } = renderHook(() => useDeleteApiKey(ORG_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync("k1")).rejects.toMatchObject({ status: 403 });
    });

    expect(cached(queryClient)).toEqual([key("k1"), key("k2")]);
  });
});
