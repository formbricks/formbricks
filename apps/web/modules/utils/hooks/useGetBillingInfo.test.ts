/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOrganizationBillingInfoAction } from "./actions";
import { useGetBillingInfo } from "./useGetBillingInfo";

vi.mock("./actions", () => ({
  getOrganizationBillingInfoAction: vi.fn(),
}));

const mockAction = vi.mocked(getOrganizationBillingInfoAction);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGetBillingInfo", () => {
  test("fetches billing info on mount", async () => {
    const billingData = { stripeCustomerId: "cus_1", limits: {} };
    mockAction.mockResolvedValue({ data: billingData } as any);

    const { result } = renderHook(() => useGetBillingInfo("org1"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.billingInfo).toEqual(billingData);
    expect(result.current.error).toBe("");
  });

  test("sets error when response has no data", async () => {
    mockAction.mockResolvedValue({ data: undefined } as any);

    const { result } = renderHook(() => useGetBillingInfo("org1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.billingInfo).toBeUndefined();
    expect(result.current.error).toContain("Missing billing record");
  });

  test("sets error when action throws", async () => {
    mockAction.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useGetBillingInfo("org1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.billingInfo).toBeUndefined();
    expect(result.current.error).toBe("Network error");
  });

  test("handles non-Error throws", async () => {
    mockAction.mockRejectedValue("string error");

    const { result } = renderHook(() => useGetBillingInfo("org1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch billing info");
  });
});
