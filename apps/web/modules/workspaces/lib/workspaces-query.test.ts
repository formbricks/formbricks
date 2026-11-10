import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { workspaceListKeys, workspaceListQueryOptions } from "./workspaces-query";

const ORG_ID = "clorg11111111111111111111";
const WORKSPACES = [{ id: "clws111111111111111111111", name: "Alpha" }];

describe("workspaceListQueryOptions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each(["read", "write"] as const)("asks for the %s list of the organization", async (access) => {
    routeFetch({
      [`GET /api/internal/workspaces?organizationId=${ORG_ID}&access=${access}`]: [
        json({ data: WORKSPACES }),
      ],
    });

    const data = await new QueryClient().fetchQuery(workspaceListQueryOptions(ORG_ID, access));

    expect(data).toEqual(WORKSPACES);
  });

  test("keys each access level apart, under one organization prefix", () => {
    expect(workspaceListQueryOptions(ORG_ID).queryKey).toEqual(workspaceListKeys.list(ORG_ID, "read"));
    expect(workspaceListKeys.list(ORG_ID, "write").slice(0, 3)).toEqual(
      workspaceListKeys.organization(ORG_ID)
    );
    expect(workspaceListKeys.list(ORG_ID, "read")).not.toEqual(workspaceListKeys.list(ORG_ID, "write"));
  });

  test("throws the server's problem", async () => {
    routeFetch({
      [`GET /api/internal/workspaces?organizationId=${ORG_ID}&access=read`]: [
        json({ status: 403, detail: "You are not authorized to access this resource" }, 403),
      ],
    });

    await expect(
      new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(
        workspaceListQueryOptions(ORG_ID)
      )
    ).rejects.toBeInstanceOf(V3ApiError);
  });
});
