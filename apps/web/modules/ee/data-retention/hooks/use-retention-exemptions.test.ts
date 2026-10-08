/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TRetentionExemption } from "../types";
import {
  useCreateRetentionExemption,
  useRetentionExemptionSurveyOptions,
  useRetentionExemptions,
  useRevokeRetentionExemption,
} from "./use-retention-exemptions";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseRetentionExemptionsTestWrapper";
  return Wrapper;
}

const exemption = (id: string): TRetentionExemption => ({
  id,
  surveyId: "clsrv11111111111111111111",
  surveyName: "Site visit feedback",
  workspaceId: "clwsp11111111111111111111",
  policy: "surveys",
  until: "2031-03-31T21:59:59.999Z",
  reason: "Supplier audit",
  createdBy: { id: "cluser1111111111111111111", name: "Anna Keller" },
  createdAt: "2030-01-02T00:00:00.000Z",
  revokedAt: null,
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status < 400 ? "application/json" : "application/problem+json" },
  });

const page = (ids: string[], nextCursor: string | null) =>
  json({ data: ids.map(exemption), meta: { limit: 25, nextCursor } });

const problem = (status: number, code: string) =>
  json({ status, title: "Unprocessable Content", detail: "Nope", code }, status);

const ORG_ID = "clorg11111111111111111111";
const LIST = "/api/internal/retention-exemptions?organizationId=clorg11111111111111111111&limit=25";

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe("Exemptions hooks", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads the exemptions and appends the next page on Load more", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(page(["exm_2"], "cursor_1")).mockResolvedValueOnce(page(["exm_1"], null));

    const { result } = renderHook(() => useRetentionExemptions({ organizationId: ORG_ID, limit: 25 }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.exemptions.map((e) => e.id)).toEqual(["exm_2"]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      LIST,
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.exemptions.map((e) => e.id)).toEqual(["exm_2", "exm_1"]));
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${LIST}&cursor=cursor_1`, expect.anything());
  });

  test("creates an exemption and refetches the list", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(page([], null))
      .mockResolvedValueOnce(json({ data: exemption("exm_new") }, 201))
      .mockResolvedValueOnce(page(["exm_new"], null));
    const wrapper = createWrapper(newQueryClient());
    const list = renderHook(() => useRetentionExemptions({ organizationId: ORG_ID, limit: 25 }), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useCreateRetentionExemption(), { wrapper });
    const input = {
      surveyId: "clsrv11111111111111111111",
      policy: "responses" as const,
      until: "2031-03-31T21:59:59.999Z",
      reason: "Supplier audit",
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/internal/retention-exemptions",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) })
    );
    await waitFor(() => expect(list.result.current.exemptions.map((e) => e.id)).toEqual(["exm_new"]));
  });

  test("surfaces the API's problem when creating fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(problem(422, "retention_exemption_exists"));
    const { result } = renderHook(() => useCreateRetentionExemption(), {
      wrapper: createWrapper(newQueryClient()),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ surveyId: "clsrv", policy: "surveys", until: "x", reason: "y" })
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  test("takes a revoked exemption out at once, and puts it back when the revoke fails", async () => {
    const fetchMock = vi.mocked(global.fetch);
    let rejectRevoke: (response: Response) => void = () => undefined;
    fetchMock
      .mockResolvedValueOnce(page(["exm_2", "exm_1"], null))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (rejectRevoke = resolve)))
      .mockResolvedValueOnce(page(["exm_2", "exm_1"], null));
    const wrapper = createWrapper(newQueryClient());
    const list = renderHook(() => useRetentionExemptions({ organizationId: ORG_ID, limit: 25 }), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const { result } = renderHook(
      () => useRevokeRetentionExemption({ queryKey: list.result.current.queryKey }),
      {
        wrapper,
      }
    );

    act(() => {
      result.current.mutate({ exemptionId: "exm_2" });
    });

    await waitFor(() => expect(list.result.current.exemptions.map((e) => e.id)).toEqual(["exm_1"]));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/internal/retention-exemptions/exm_2/revoke",
      expect.objectContaining({ method: "POST" })
    );

    await act(async () => {
      rejectRevoke(problem(422, "retention_exemption_not_active"));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() => expect(list.result.current.exemptions.map((e) => e.id)).toEqual(["exm_2", "exm_1"]));
  });

  test("asks for survey options only while the picker is open, with the search", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      json({ data: [{ id: "clsrv", name: "Site visit feedback", workspaceName: "Europe" }] })
    );
    const wrapper = createWrapper(newQueryClient());

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useRetentionExemptionSurveyOptions({ organizationId: ORG_ID, search: "site", enabled }),
      { wrapper, initialProps: { enabled: false } }
    );
    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/retention-exemptions/survey-options?organizationId=${ORG_ID}&search=site`,
      expect.objectContaining({ method: "GET" })
    );
  });
});
