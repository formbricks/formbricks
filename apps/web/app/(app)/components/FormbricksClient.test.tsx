import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { usePathname, useSearchParams } from "next/navigation";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import formbricks from "@formbricks/js";
import { FormbricksClient } from "./FormbricksClient";

// Mock the formbricks module
vi.mock("@formbricks/js", () => ({
  default: {
    init: vi.fn(),
    setEmail: vi.fn(),
    registerRouteChange: vi.fn(),
  },
}));

describe("FormbricksClient", () => {
  beforeAll(() => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ test: "true" }) as any);
    vi.mocked(usePathname).mockReturnValue(new URLSearchParams("/test-path") as any);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders null", () => {
    const { container } = render(
      <FormbricksClient
        userId="user-123"
        email="test@example.com"
        formbricksEnvironmentId="env-123"
        formbricksApiHost="http://api.example.com"
        formbricksEnabled={true}
      />
    );
    // Since the component returns null, there should be no rendered output
    expect(container.firstChild).toBeNull();
  });

  it("initializes formbricks on mount when userId is provided", () => {
    render(
      <FormbricksClient
        userId="user-123"
        email="test@example.com"
        formbricksEnvironmentId="env-123"
        formbricksApiHost="http://api.example.com"
        formbricksEnabled={true}
      />
    );

    expect(formbricks.init).toHaveBeenCalledWith({
      environmentId: "env-123",
      apiHost: "http://api.example.com",
      userId: "user-123",
    });

    expect(formbricks.setEmail).toHaveBeenCalledWith("test@example.com");
    expect(formbricks.registerRouteChange).toHaveBeenCalled();
  });

  it("initializes formbricks on mount when without environment id and api host if not provided", () => {
    render(<FormbricksClient userId="user-123" email="test@example.com" formbricksEnabled={true} />);

    expect(formbricks.init).toHaveBeenCalledWith({
      environmentId: "",
      apiHost: "",
      userId: "user-123",
    });

    expect(formbricks.setEmail).toHaveBeenCalledWith("test@example.com");
    expect(formbricks.registerRouteChange).toHaveBeenCalled();
  });

  it("does not initialize formbricks if userId is empty", () => {
    render(
      <FormbricksClient
        userId=""
        email="test@example.com"
        formbricksEnvironmentId="env-123"
        formbricksApiHost="http://api.example.com"
        formbricksEnabled={true}
      />
    );

    // When no userId is provided, formbricks.init and setEmail should not be called
    expect(formbricks.init).not.toHaveBeenCalled();
    expect(formbricks.setEmail).not.toHaveBeenCalled();

    // However, registerRouteChange might still be called since it's independent of userId
    expect(formbricks.registerRouteChange).toHaveBeenCalled();
  });
});
