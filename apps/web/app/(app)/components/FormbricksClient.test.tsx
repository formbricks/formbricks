import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import formbricks from "@formbricks/js";
import { FormbricksClient } from "./FormbricksClient";

// Mock next/navigation hooks.
vi.mock("next/navigation", () => ({
  usePathname: () => "/test-path",
  useSearchParams: () => new URLSearchParams("foo=bar"),
}));

// Mock the environment variables.
vi.mock("@formbricks/lib/env", () => ({
  env: {
    NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID: "env-test",
    NEXT_PUBLIC_FORMBRICKS_API_HOST: "https://api.test.com",
  },
}));

// Mock the flag that enables Formbricks.
vi.mock("@/app/lib/formbricks", () => ({
  formbricksEnabled: true,
}));

// Mock the Formbricks SDK module.
vi.mock("@formbricks/js", () => ({
  __esModule: true,
  default: {
    setup: vi.fn(),
    setUserId: vi.fn(),
    setEmail: vi.fn(),
    registerRouteChange: vi.fn(),
  },
}));

describe("FormbricksClient", () => {
  test("calls setup, setUserId, setEmail and registerRouteChange on mount when enabled", () => {
    const mockSetup = vi.spyOn(formbricks, "setup");
    const mockSetUserId = vi.spyOn(formbricks, "setUserId");
    const mockSetEmail = vi.spyOn(formbricks, "setEmail");
    const mockRegisterRouteChange = vi.spyOn(formbricks, "registerRouteChange");

    render(<FormbricksClient userId="user-123" email="test@example.com" />);

    // Expect the first effect to call setup and assign the provided user details.
    expect(mockSetup).toHaveBeenCalledWith({
      environmentId: "env-test",
      appUrl: "https://api.test.com",
    });
    expect(mockSetUserId).toHaveBeenCalledWith("user-123");
    expect(mockSetEmail).toHaveBeenCalledWith("test@example.com");

    // And the second effect should always register the route change when Formbricks is enabled.
    expect(mockRegisterRouteChange).toHaveBeenCalled();
  });

  test("does not call setup, setUserId, or setEmail if userId is not provided yet still calls registerRouteChange", () => {
    const mockSetup = vi.spyOn(formbricks, "setup");
    const mockSetUserId = vi.spyOn(formbricks, "setUserId");
    const mockSetEmail = vi.spyOn(formbricks, "setEmail");
    const mockRegisterRouteChange = vi.spyOn(formbricks, "registerRouteChange");

    render(<FormbricksClient userId="" email="test@example.com" />);

    // Since userId is falsy, the first effect should not call setup or assign user details.
    expect(mockSetup).not.toHaveBeenCalled();
    expect(mockSetUserId).not.toHaveBeenCalled();
    expect(mockSetEmail).not.toHaveBeenCalled();

    // The second effect only checks formbricksEnabled, so registerRouteChange should be called.
    expect(mockRegisterRouteChange).toHaveBeenCalled();
  });
});
