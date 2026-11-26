/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { useOrganizationTeams } from "./use-organization-teams";

const ORG_ID = "clorg11111111111111111111";
const LIST_URL = `/api/internal/teams?organizationId=${ORG_ID}`;
const TEAMS = [{ id: "clteam1111111111111111111", name: "Product" }];

describe("useOrganizationTeams", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("lists the organization's teams while the dialog is open", async () => {
    routeFetch({ [`GET ${LIST_URL}`]: [json({ data: TEAMS })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useOrganizationTeams(ORG_ID, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(TEAMS);
  });

  test("asks nothing while the dialog is closed", () => {
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useOrganizationTeams(ORG_ID, { enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("surfaces a refusal as the server's problem", async () => {
    routeFetch({
      [`GET ${LIST_URL}`]: [
        json({ status: 403, detail: "You are not authorized to access this resource" }, 403),
      ],
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useOrganizationTeams(ORG_ID, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(V3ApiError);
    expect((result.current.error as V3ApiError).status).toBe(403);
  });
});
