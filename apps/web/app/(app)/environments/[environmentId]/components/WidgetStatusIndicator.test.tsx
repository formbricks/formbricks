import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { WidgetStatusIndicator } from "./WidgetStatusIndicator";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  AlertTriangleIcon: () => <div data-testid="alert-icon">AlertTriangleIcon</div>,
  CheckIcon: () => <div data-testid="check-icon">CheckIcon</div>,
  RotateCcwIcon: () => <div data-testid="refresh-icon">RotateCcwIcon</div>,
}));

// Mock Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

const mockEnvironmentNotImplemented: TEnvironment = {
  id: "env-not-implemented",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  projectId: "proj1",
  appSetupCompleted: false, // Not implemented state
};

const mockEnvironmentRunning: TEnvironment = {
  id: "env-running",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  projectId: "proj1",
  appSetupCompleted: true, // Running state
};

describe("WidgetStatusIndicator", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly for 'notImplemented' state", () => {
    render(<WidgetStatusIndicator environment={mockEnvironmentNotImplemented} />);

    // Check icon
    expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();

    // Check texts
    expect(
      screen.getByText("environments.project.app-connection.formbricks_sdk_not_connected")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.app-connection.formbricks_sdk_not_connected_description")
    ).toBeInTheDocument();

    // Check button
    const recheckButton = screen.getByRole("button", { name: /environments.project.app-connection.recheck/ });
    expect(recheckButton).toBeInTheDocument();
    expect(screen.getByTestId("refresh-icon")).toBeInTheDocument();
  });

  test("renders correctly for 'running' state", () => {
    render(<WidgetStatusIndicator environment={mockEnvironmentRunning} />);

    // Check icon
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("alert-icon")).not.toBeInTheDocument();

    // Check texts
    expect(screen.getByText("environments.project.app-connection.receiving_data")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.app-connection.formbricks_sdk_connected")
    ).toBeInTheDocument();

    // Check button absence
    expect(
      screen.queryByRole("button", { name: /environments.project.app-connection.recheck/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("refresh-icon")).not.toBeInTheDocument();
  });

  test("calls router.refresh when 'Recheck' button is clicked", async () => {
    render(<WidgetStatusIndicator environment={mockEnvironmentNotImplemented} />);

    const recheckButton = screen.getByRole("button", { name: /environments.project.app-connection.recheck/ });
    await userEvent.click(recheckButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
