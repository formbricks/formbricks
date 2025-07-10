import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { render } from "@testing-library/react";
import { type MockedFunction, beforeEach, describe, expect, test, vi } from "vitest";
import { ClientLogout } from "./index";

// Mock next-auth/react
const mockSignOut = vi.fn();
vi.mock("@/modules/auth/hooks/use-sign-out", () => ({
  useSignOut: vi.fn(),
}));

const mockUseSignOut = useSignOut as MockedFunction<typeof useSignOut>;

describe("ClientLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSignOut.mockReturnValue({
      signOut: mockSignOut,
    });
  });

  test("calls signOut with correct parameters on render", () => {
    render(<ClientLogout />);

    expect(mockUseSignOut).toHaveBeenCalled();

    expect(mockSignOut).toHaveBeenCalledWith({
      reason: "forced_logout",
      redirectUrl: "/auth/login",
      redirect: false,
      callbackUrl: "/auth/login",
      clearEnvironmentId: true,
    });
  });

  test("handles missing userId and userEmail", () => {
    render(<ClientLogout />);

    expect(mockUseSignOut).toHaveBeenCalled();

    expect(mockSignOut).toHaveBeenCalledWith({
      reason: "forced_logout",
      redirectUrl: "/auth/login",
      redirect: false,
      callbackUrl: "/auth/login",
      clearEnvironmentId: true,
    });
  });

  test("renders null", () => {
    const { container } = render(<ClientLogout />);
    expect(container.firstChild).toBeNull();
  });
});
