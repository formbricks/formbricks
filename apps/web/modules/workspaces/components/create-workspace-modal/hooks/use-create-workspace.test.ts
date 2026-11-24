/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { workspaceListKeys } from "@/modules/workspaces/lib/workspaces-query";
import { useCreateWorkspace } from "./use-create-workspace";

const ORG_ID = "clorg11111111111111111111";
const OTHER_ORG_ID = "clorg22222222222222222222";
const TEAM_ID = "clteam1111111111111111111";
const CREATE_URL = `/api/internal/workspaces?organizationId=${ORG_ID}`;
const CREATED = { id: "clws111111111111111111111", name: "New" };

describe("useCreateWorkspace", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts the name and teams to the organization, and answers the new workspace", async () => {
    routeFetch({ [`POST ${CREATE_URL}`]: [json({ data: CREATED }, 201)] });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCreateWorkspace(ORG_ID), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({ name: "New", teamIds: [TEAM_ID] });
    });

    expect(created).toEqual(CREATED);
    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "New", teamIds: [TEAM_ID] });
  });

  test("marks every list of the organization's workspaces stale, and no other organization's", async () => {
    routeFetch({ [`POST ${CREATE_URL}`]: [json({ data: CREATED }, 201)] });
    const { wrapper, queryClient } = createQueryWrapper();
    queryClient.setQueryData(workspaceListKeys.list(ORG_ID, "read"), []);
    queryClient.setQueryData(workspaceListKeys.list(ORG_ID, "write"), []);
    queryClient.setQueryData(workspaceListKeys.list(OTHER_ORG_ID, "read"), []);
    const { result } = renderHook(() => useCreateWorkspace(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "New" });
    });

    const isStale = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
    expect(isStale(workspaceListKeys.list(ORG_ID, "read"))).toBe(true);
    expect(isStale(workspaceListKeys.list(ORG_ID, "write"))).toBe(true);
    expect(isStale(workspaceListKeys.list(OTHER_ORG_ID, "read"))).toBe(false);
  });

  test("surfaces a refusal as the server's problem, and invalidates nothing", async () => {
    routeFetch({
      [`POST ${CREATE_URL}`]: [json({ status: 403, detail: "Organization workspace limit reached" }, 403)],
    });
    const { wrapper, queryClient } = createQueryWrapper();
    queryClient.setQueryData(workspaceListKeys.list(ORG_ID, "read"), []);
    const { result } = renderHook(() => useCreateWorkspace(ORG_ID), { wrapper });

    act(() => result.current.mutate({ name: "New" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(V3ApiError);
    expect((result.current.error as V3ApiError).detail).toBe("Organization workspace limit reached");
    expect(queryClient.getQueryState(workspaceListKeys.list(ORG_ID, "read"))?.isInvalidated).toBe(false);
  });
});
