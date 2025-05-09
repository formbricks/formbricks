import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import LoadingPage from "./loading";

// Mock the IS_FORMBRICKS_CLOUD constant
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
}));

// Mock the actual Loading component that is being imported
vi.mock("@/modules/organization/settings/api-keys/loading", () => ({
  default: ({ isFormbricksCloud }: { isFormbricksCloud: boolean }) => (
    <div data-testid="mocked-loading-component">isFormbricksCloud: {String(isFormbricksCloud)}</div>
  ),
}));

describe("LoadingPage for API Keys", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the underlying Loading component with correct isFormbricksCloud prop", () => {
    render(<LoadingPage />);
    const mockedLoadingComponent = screen.getByTestId("mocked-loading-component");
    expect(mockedLoadingComponent).toBeInTheDocument();
    // Check if the prop is passed correctly based on the mocked constant value
    expect(mockedLoadingComponent).toHaveTextContent("isFormbricksCloud: true");
  });
});
