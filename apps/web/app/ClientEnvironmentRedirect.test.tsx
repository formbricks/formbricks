import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import ClientEnvironmentRedirect from "./ClientEnvironmentRedirect";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

describe("ClientEnvironmentRedirect", () => {
  afterEach(() => {
    cleanup();
  });

  test("should redirect to the provided environment ID when no last environment exists", () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });

    render(<ClientEnvironmentRedirect environmentId="test-env-id" />);

    expect(mockPush).toHaveBeenCalledWith("/environments/test-env-id");
  });

  test("should redirect to the last environment ID when it exists in localStorage", () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    // Mock localStorage with a last environment ID
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue("last-env-id"),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });

    render(<ClientEnvironmentRedirect environmentId="test-env-id" />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS);
    expect(mockPush).toHaveBeenCalledWith("/environments/last-env-id");
  });

  test("should update redirect when environment ID prop changes", () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });

    const { rerender } = render(<ClientEnvironmentRedirect environmentId="initial-env-id" />);
    expect(mockPush).toHaveBeenCalledWith("/environments/initial-env-id");

    // Clear mock calls
    mockPush.mockClear();

    // Rerender with new environment ID
    rerender(<ClientEnvironmentRedirect environmentId="new-env-id" />);
    expect(mockPush).toHaveBeenCalledWith("/environments/new-env-id");
  });
});
