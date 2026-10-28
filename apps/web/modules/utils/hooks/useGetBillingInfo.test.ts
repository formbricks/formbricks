/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { useGetBillingInfo } from "./useGetBillingInfo";

const ORG_ID = "clorg11111111111111111111";
const BILLING_URL = `GET /api/internal/organizations/${ORG_ID}/billing`;
const limits = { workspaces: 3, monthly: { responses: 1500, workflowRuns: null } };

describe("useGetBillingInfo", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the organization's plan limits", async () => {
    routeFetch({ [BILLING_URL]: [json({ data: { limits } })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGetBillingInfo(ORG_ID), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.billingInfo).toEqual({ limits });
    expect(result.current.error).toBe("");
  });

  test("reports the refusal for a caller who may not see billing, without retrying it", async () => {
    routeFetch({
      [BILLING_URL]: [
        json(
          { status: 403, title: "Forbidden", detail: "You are not authorized to access this resource" },
          403
        ),
      ],
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGetBillingInfo(ORG_ID), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.billingInfo).toBeUndefined();
    expect(result.current.error).toBe("You are not authorized to access this resource");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("shares one request between every caller of the same organization", async () => {
    routeFetch({ [BILLING_URL]: [json({ data: { limits } })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => [useGetBillingInfo(ORG_ID), useGetBillingInfo(ORG_ID)], { wrapper });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0].billingInfo).toEqual({ limits });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
