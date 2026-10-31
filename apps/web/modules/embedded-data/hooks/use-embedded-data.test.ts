/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { embeddedDataKeys } from "../lib/query";
import {
  useCreateEmbeddedData,
  useDeleteEmbeddedData,
  useEmbeddedDataLibrary,
  useEmbeddedDataUsage,
  usePromoteEmbeddedData,
  useUpdateEmbeddedData,
} from "./use-embedded-data";

const WORKSPACE_ID = "clwork1111111111111111111";
const FIELD_ID = "clfield111111111111111111";
const EXISTING_ID = "clfield222222222222222222";
const LIST_URL = `/api/internal/embedded-data?workspaceId=${WORKSPACE_ID}`;
const fieldUrl = (suffix = "") => `/api/internal/embedded-data/${FIELD_ID}${suffix}`;

const field = (overrides: Record<string, unknown> = {}) => ({
  id: FIELD_ID,
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});
const USAGE = [{ id: "clsurv1111111111111111111", name: "Onboarding", status: "inProgress" }];

const conflict = (detail: string, details: Record<string, unknown>) =>
  json({ status: 409, detail, code: "conflict", details }, 409);

const setup = () => {
  const { queryClient, wrapper } = createQueryWrapper();
  queryClient.setQueryData(embeddedDataKeys.list(WORKSPACE_ID), [{ ...field(), surveyCount: 0 }]);
  return { queryClient, wrapper };
};

const isListInvalidated = (queryClient: ReturnType<typeof setup>["queryClient"]) =>
  queryClient.getQueryState(embeddedDataKeys.list(WORKSPACE_ID))?.isInvalidated;

describe("embedded data hooks", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the workspace's library", async () => {
    routeFetch({ [`GET ${LIST_URL}`]: [json({ data: [{ ...field(), surveyCount: 2 }] })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useEmbeddedDataLibrary(WORKSPACE_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ ...field(), surveyCount: 2 }]);
  });

  test("reads a field's usage only once asked to", async () => {
    routeFetch({ [`GET ${fieldUrl("/usage")}`]: [json({ data: USAGE })] });
    const { wrapper } = createQueryWrapper();

    const { result, rerender } = renderHook(({ enabled }) => useEmbeddedDataUsage(FIELD_ID, { enabled }), {
      wrapper,
      initialProps: { enabled: false },
    });
    expect(global.fetch).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual(USAGE));
  });

  test("gives up on a refusal at once, even under a client that retries everything (the editor's)", async () => {
    routeFetch({
      [`GET ${LIST_URL}`]: [json({ status: 403, detail: "Forbidden", code: "forbidden" }, 403)],
      [`GET ${fieldUrl("/usage")}`]: [json({ status: 403, detail: "Forbidden", code: "forbidden" }, 403)],
    });
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => ({
        library: useEmbeddedDataLibrary(WORKSPACE_ID),
        usage: useEmbeddedDataUsage(FIELD_ID, { enabled: true }),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.library.isError && result.current.usage.isError).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });

  test("a created field comes back as ok, and the library is marked stale", async () => {
    routeFetch({
      [`POST ${LIST_URL}`]: [json({ data: field() }, 201)],
      [`GET ${LIST_URL}`]: [json({ data: [{ ...field(), surveyCount: 0 }] })],
    });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useCreateEmbeddedData(WORKSPACE_ID), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ key: "plan_tier", name: "Plan tier", source: "ingested" });
    });

    expect(outcome).toEqual({ status: "ok", field: field() });
    await waitFor(() => expect(isListInvalidated(queryClient)).toBe(true));
  });

  test("a taken key comes back as keyConflict with the row holding it, and still marks the library stale", async () => {
    routeFetch({
      [`POST ${fieldUrl("/promotion")}`]: [
        conflict("Embedded data key already exists", { reason: "key_conflict", existingId: EXISTING_ID }),
      ],
      [`GET ${LIST_URL}`]: [json({ data: [] })],
    });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => usePromoteEmbeddedData(WORKSPACE_ID), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ id: FIELD_ID, body: { key: "plan_tier" } });
    });

    expect(outcome).toEqual({ status: "keyConflict", existingId: EXISTING_ID });
    await waitFor(() => expect(isListInvalidated(queryClient)).toBe(true));
  });

  test("a delete blocked by surveys comes back as inUse naming them", async () => {
    routeFetch({
      [`DELETE ${fieldUrl()}`]: [
        conflict("Cannot delete a field that is used by a survey", { reason: "in_use", usage: USAGE }),
      ],
      [`GET ${LIST_URL}`]: [json({ data: [] })],
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useDeleteEmbeddedData(WORKSPACE_ID), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync(FIELD_ID);
    });

    expect(outcome).toEqual({
      status: "inUse",
      message: "Cannot delete a field that is used by a survey",
      usage: USAGE,
    });
  });

  test("a delete that goes through comes back as ok", async () => {
    routeFetch({
      [`DELETE ${fieldUrl()}`]: [json(null, 204)],
      [`GET ${LIST_URL}`]: [json({ data: [] })],
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useDeleteEmbeddedData(WORKSPACE_ID), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync(FIELD_ID);
    });

    expect(outcome).toEqual({ status: "ok" });
  });

  test("sends an update's acknowledgement in the body", async () => {
    routeFetch({
      [`PATCH ${fieldUrl()}`]: [json({ data: field({ dataType: "number" }) })],
      [`GET ${LIST_URL}`]: [json({ data: [] })],
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateEmbeddedData(WORKSPACE_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: FIELD_ID,
        body: { dataType: "number", acknowledgeExistingResponses: true },
      });
    });

    const patch = vi.mocked(global.fetch).mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      dataType: "number",
      acknowledgeExistingResponses: true,
    });
  });

  test.each([
    ["any other refusal", json({ status: 400, detail: "Key is reserved", code: "bad_request" }, 400)],
    ["a 409 that is not one of the library's", conflict("Conflict", { reason: "something_else" })],
  ])("throws %s, for the caller to report", async (_label, answer) => {
    routeFetch({ [`POST ${LIST_URL}`]: [answer], [`GET ${LIST_URL}`]: [json({ data: [] })] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateEmbeddedData(WORKSPACE_ID), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ key: "userId", name: "User", source: "ingested" })
      ).rejects.toMatchObject({ name: "V3ApiError" });
    });
  });
});
