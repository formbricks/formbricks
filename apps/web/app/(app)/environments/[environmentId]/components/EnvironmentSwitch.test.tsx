import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { EnvironmentSwitch } from "./EnvironmentSwitch";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
}));

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

const mockEnvironmentDev: TEnvironment = {
  id: "dev-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  projectId: "project-id",
  appSetupCompleted: true,
};

const mockEnvironmentProd: TEnvironment = {
  id: "prod-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  projectId: "project-id",
  appSetupCompleted: true,
};

const mockEnvironments = [mockEnvironmentDev, mockEnvironmentProd];

describe("EnvironmentSwitch", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders checked when environment is development", () => {
    render(<EnvironmentSwitch environment={mockEnvironmentDev} environments={mockEnvironments} />);
    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();
    expect(screen.getByText("common.dev_env")).toHaveClass("text-orange-800");
  });

  test("renders unchecked when environment is production", () => {
    render(<EnvironmentSwitch environment={mockEnvironmentProd} environments={mockEnvironments} />);
    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
    expect(screen.getByText("common.dev_env")).not.toHaveClass("text-orange-800");
  });

  test("calls router.push with development environment ID when toggled from production", async () => {
    render(<EnvironmentSwitch environment={mockEnvironmentProd} environments={mockEnvironments} />);
    const switchElement = screen.getByRole("switch");

    expect(switchElement).not.toBeChecked();
    await userEvent.click(switchElement);

    // Check loading state (switch disabled)
    expect(switchElement).toBeDisabled();

    // Check router push call
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/environments/${mockEnvironmentDev.id}/`);
    });

    // Check visual state change (though state update happens before navigation)
    // In a real scenario, the component would re-render with the new environment prop after navigation.
    // Here, we simulate the state change directly for testing the toggle logic.
    await waitFor(() => {
      // Re-render or check internal state if possible, otherwise check mock calls
      // Since the component manages its own state, we can check the visual state after click
      expect(switchElement).toBeChecked(); // State updates immediately
    });
  });

  test("calls router.push with production environment ID when toggled from development", async () => {
    render(<EnvironmentSwitch environment={mockEnvironmentDev} environments={mockEnvironments} />);
    const switchElement = screen.getByRole("switch");

    expect(switchElement).toBeChecked();
    await userEvent.click(switchElement);

    // Check loading state (switch disabled)
    expect(switchElement).toBeDisabled();

    // Check router push call
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/environments/${mockEnvironmentProd.id}/`);
    });

    // Check visual state change
    await waitFor(() => {
      expect(switchElement).not.toBeChecked(); // State updates immediately
    });
  });

  test("does not call router.push if target environment is not found", async () => {
    const incompleteEnvironments = [mockEnvironmentProd]; // Only production exists
    render(<EnvironmentSwitch environment={mockEnvironmentProd} environments={incompleteEnvironments} />);
    const switchElement = screen.getByRole("switch");

    await userEvent.click(switchElement); // Try to toggle to development

    await waitFor(() => {
      expect(switchElement).toBeDisabled(); // Loading state still set
    });

    // router.push should not be called because dev env is missing
    expect(mockPush).not.toHaveBeenCalled();

    // State still updates visually
    await waitFor(() => {
      expect(switchElement).toBeChecked();
    });
  });

  test("toggles using the label click", async () => {
    render(<EnvironmentSwitch environment={mockEnvironmentProd} environments={mockEnvironments} />);
    const labelElement = screen.getByText("common.dev_env");
    const switchElement = screen.getByRole("switch");

    expect(switchElement).not.toBeChecked();
    await userEvent.click(labelElement); // Click the label

    // Check loading state (switch disabled)
    expect(switchElement).toBeDisabled();

    // Check router push call
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/environments/${mockEnvironmentDev.id}/`);
    });

    // Check visual state change
    await waitFor(() => {
      expect(switchElement).toBeChecked();
    });
  });
});
