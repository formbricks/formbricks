/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { retentionPolicyKeys } from "../lib/query";
import { useRetentionHealth } from "./use-retention-health";
import { useRetentionPolicies, useUpdateRetentionPolicy } from "./use-retention-policies";

const ORG_ID = "clorg11111111111111111111";
const URL = `/api/internal/retention-policies?organizationId=${ORG_ID}`;
const HEALTH_URL = `/api/internal/retention-health?organizationId=${ORG_ID}`;

const documentWith = (surveysEnabled: boolean) => ({
  responses: { enabled: false, warnDays: 60, periodDays: 1095 },
  surveys: {
    enabled: surveysEnabled,
    warnDays: 60,
    periodDays: 1095,
    conditions: ["noResponse", "noChange"],
  },
  members: { enabled: false, warnDays: 60, periodDays: 365 },
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status < 400 ? "application/json" : "application/problem+json" },
  });

/**
 * Answer `fetch` by method and URL rather than by call order, so an extra request (a refetch, another
 * hook) gets its own route's answer instead of someone else's. Each route answers in turn and repeats its
 * last answer; an unexpected request fails the test.
 */
const routeFetch = (routes: Record<string, Response[]>) =>
  vi.mocked(global.fetch).mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const answers = routes[key];
    if (!answers) throw new Error(`Unexpected request: ${key}`);
    return (answers.length > 1 ? answers.shift()! : answers[0]).clone();
  });

const requests = (method: string, url: string) =>
  vi
    .mocked(global.fetch)
    .mock.calls.filter(([input, init]) => String(input) === url && (init?.method ?? "GET") === method);

const wrapperFor = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseRetentionPoliciesTestWrapper";
  return Wrapper;
};

describe("Policies hooks", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads the document and replaces it with the one a change returns, without refetching", async () => {
    routeFetch({
      [`GET ${URL}`]: [json({ data: documentWith(false) })],
      [`PATCH ${URL}`]: [json({ data: documentWith(true) })],
    });
    const wrapper = wrapperFor(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    const read = renderHook(() => useRetentionPolicies({ organizationId: ORG_ID }), { wrapper });
    await waitFor(() => expect(read.result.current.data?.surveys.enabled).toBe(false));
    const { result } = renderHook(() => useUpdateRetentionPolicy({ organizationId: ORG_ID }), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ surveys: { enabled: true } });
    });

    await waitFor(() => expect(read.result.current.data?.surveys.enabled).toBe(true));
    expect(requests("GET", URL)).toHaveLength(1);
    expect(requests("PATCH", URL)).toEqual([
      [URL, expect.objectContaining({ body: JSON.stringify({ surveys: { enabled: true } }) })],
    ]);
  });

  test("refreshes the health banners after a change, since switching a policy changes which apply", async () => {
    const health = (smtpConfigured: boolean) => json({ data: { issues: [], smtpConfigured } });
    routeFetch({
      [`GET ${HEALTH_URL}`]: [health(true), health(false)],
      [`PATCH ${URL}`]: [json({ data: documentWith(true) })],
    });
    const wrapper = wrapperFor(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    const read = renderHook(() => useRetentionHealth({ organizationId: ORG_ID }), { wrapper });
    await waitFor(() => expect(read.result.current.data?.smtpConfigured).toBe(true));
    const { result } = renderHook(() => useUpdateRetentionPolicy({ organizationId: ORG_ID }), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ surveys: { enabled: true } });
    });

    await waitFor(() => expect(read.result.current.data?.smtpConfigured).toBe(false));
    expect(requests("GET", HEALTH_URL)).toHaveLength(2);
  });

  test("refetches after a failed change, in case the server moved on", async () => {
    routeFetch({
      [`GET ${URL}`]: [json({ data: documentWith(false) }), json({ data: documentWith(true) })],
      [`PATCH ${URL}`]: [json({ status: 422, title: "Unprocessable", detail: "No", code: "x" }, 422)],
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = wrapperFor(qc);
    const read = renderHook(() => useRetentionPolicies({ organizationId: ORG_ID }), { wrapper });
    await waitFor(() => expect(read.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useUpdateRetentionPolicy({ organizationId: ORG_ID }), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ surveys: { warnDays: 10 } })).rejects.toMatchObject({
        status: 422,
      });
    });

    await waitFor(() =>
      expect(
        qc.getQueryData<{ surveys: { enabled: boolean } }>(retentionPolicyKeys.detail(ORG_ID))?.surveys
          .enabled
      ).toBe(true)
    );
    expect(requests("GET", URL)).toHaveLength(2);
  });
});
