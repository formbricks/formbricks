import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getMembershipByUserIdOrganizationIdAction } from "./actions";
import { useMembershipRole } from "./useMembershipRole";

vi.mock("./actions", () => ({
  getMembershipByUserIdOrganizationIdAction: vi.fn(),
}));

describe("useMembershipRole", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should fetch and return membership role", async () => {
    const mockRole: TOrganizationRole = "owner";
    vi.mocked(getMembershipByUserIdOrganizationIdAction).mockResolvedValue(mockRole);

    const { result } = renderHook(() => useMembershipRole("env-123", "user-123"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.membershipRole).toBeUndefined();
    expect(result.current.error).toBe("");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.membershipRole).toBe(mockRole);
    expect(result.current.error).toBe("");
    expect(getMembershipByUserIdOrganizationIdAction).toHaveBeenCalledWith("env-123", "user-123");
  });

  test("should handle error when fetching membership role fails", async () => {
    const errorMessage = "Failed to fetch role";
    vi.mocked(getMembershipByUserIdOrganizationIdAction).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useMembershipRole("env-123", "user-123"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.membershipRole).toBeUndefined();
    expect(result.current.error).toBe("");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.membershipRole).toBeUndefined();
    expect(result.current.error).toBe(errorMessage);
    expect(getMembershipByUserIdOrganizationIdAction).toHaveBeenCalledWith("env-123", "user-123");
  });
});
