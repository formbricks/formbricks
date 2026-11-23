/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  useContactDirectories,
  useCreateContactDirectory,
  useUpdateContactDirectory,
} from "./use-contact-directories";

const ORG_ID = "clorg11111111111111111111";
const LIST_URL = `/api/internal/contact-directories?organizationId=${ORG_ID}`;
const DIRECTORY = {
  id: "cldir1",
  name: "Northwind EU",
  matchingKey: "email",
  workspaces: [{ id: "w1", name: "HCP" }],
  contactCount: 0,
  workspaceCanMove: true,
};
const LIST = { directories: [DIRECTORY], workspaces: [{ id: "w1", name: "HCP", directoryId: "cldir1" }] };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status < 400 ? "application/json" : "application/problem+json" },
  });

/** Answers `fetch` by method and URL, so an extra refetch gets its route's answer rather than another's. */
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
  const Wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseContactDirectoriesTestWrapper";
  return Wrapper;
};

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe("contact directory hooks", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads the organization's list", async () => {
    routeFetch({ [`GET ${LIST_URL}`]: [json({ data: LIST })] });
    const { result } = renderHook(() => useContactDirectories({ organizationId: ORG_ID }), {
      wrapper: wrapperFor(newClient()),
    });

    await waitFor(() => expect(result.current.data).toEqual(LIST));
  });

  test("creating a directory posts it and refetches the list, so the picker sees the moved workspaces", async () => {
    routeFetch({
      [`GET ${LIST_URL}`]: [json({ data: LIST })],
      [`POST ${LIST_URL}`]: [json({ data: DIRECTORY }, 201)],
    });
    const wrapper = wrapperFor(newClient());
    const read = renderHook(() => useContactDirectories({ organizationId: ORG_ID }), { wrapper });
    await waitFor(() => expect(read.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useCreateContactDirectory({ organizationId: ORG_ID }), { wrapper });

    const input = { name: "Northwind EU", matchingKey: "email" as const, workspaceIds: ["w1"] };
    await act(async () => {
      await result.current.mutateAsync(input);
    });

    const [, init] = requests("POST", LIST_URL)[0];
    expect(JSON.parse(String(init?.body))).toEqual(input);
    await waitFor(() => expect(requests("GET", LIST_URL)).toHaveLength(2));
  });

  test("updating a directory patches it by id and surfaces the route's problem as a V3ApiError", async () => {
    const patchUrl = "/api/internal/contact-directories/cldir1";
    routeFetch({
      [`GET ${LIST_URL}`]: [json({ data: LIST })],
      [`PATCH ${patchUrl}`]: [
        json({ status: 409, detail: "taken", code: "contact_directory_name_taken", requestId: "r" }, 409),
      ],
    });
    const { result } = renderHook(() => useUpdateContactDirectory({ organizationId: ORG_ID }), {
      wrapper: wrapperFor(newClient()),
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ directoryId: "cldir1", input: { name: "Taken" } });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(V3ApiError);
    expect(caught).toMatchObject({ status: 409, code: "contact_directory_name_taken" });
    expect(JSON.parse(String(requests("PATCH", patchUrl)[0][1]?.body))).toEqual({ name: "Taken" });
  });
});
