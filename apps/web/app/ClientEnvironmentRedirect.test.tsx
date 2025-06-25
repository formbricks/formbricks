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

  test("should redirect to the first environment ID when no last environment exists", () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      removeItem: vi.fn(),
    };

    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });

    render(<ClientEnvironmentRedirect userEnvironments={["test-env-id"]} />);

    expect(mockPush).toHaveBeenCalledWith("/environments/test-env-id");
  });

  test("should redirect to the last environment ID when it exists in localStorage and is valid", () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    // Mock localStorage with a last environment ID
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue("last-env-id"),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });

    render(<ClientEnvironmentRedirect userEnvironments={["last-env-id", "other-env-id"]} />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS);
    expect(mockPush).toHaveBeenCalledWith("/environments/last-env-id");
  });

  test("should clear invalid environment ID and redirect to default when stored ID is not in user environments", () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    // Mock localStorage with an invalid environment ID
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue("invalid-env-id"),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });

    render(<ClientEnvironmentRedirect userEnvironments={["valid-env-1", "valid-env-2"]} />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS);
    expect(mockPush).toHaveBeenCalledWith("/environments/valid-env-1");
  });

  test("should update redirect when environment ID prop changes", () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });

    const { rerender } = render(<ClientEnvironmentRedirect userEnvironments={["initial-env-id"]} />);
    expect(mockPush).toHaveBeenCalledWith("/environments/initial-env-id");

    // Clear mock calls
    mockPush.mockClear();

    // Rerender with new environment ID
    rerender(<ClientEnvironmentRedirect userEnvironments={["new-env-id"]} />);
    expect(mockPush).toHaveBeenCalledWith("/environments/new-env-id");
  });
});
