import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { IconBar } from "./index";

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ children, tooltipContent }: { children: React.ReactNode; tooltipContent: string }) => (
    <div data-testid="tooltip" data-tooltip={tooltipContent}>
      {children}
    </div>
  ),
}));

vi.mock("../button", () => ({
  Button: ({ children, onClick, className, size, "aria-label": ariaLabel }: any) => (
    <button
      data-testid="button"
      data-class-name={className}
      data-size={size}
      onClick={onClick}
      aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

describe("IconBar", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders nothing when actions array is empty", () => {
    const { container } = render(<IconBar actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders only visible actions", () => {
    const MockIcon1 = () => <div data-testid="mock-icon-1">Icon 1</div>;
    const MockIcon2 = () => <div data-testid="mock-icon-2">Icon 2</div>;

    const actions = [
      {
        icon: MockIcon1,
        tooltip: "Action 1",
        onClick: vi.fn(),
        isVisible: true,
      },
      {
        icon: MockIcon2,
        tooltip: "Action 2",
        onClick: vi.fn(),
        isVisible: false,
      },
    ];

    render(<IconBar actions={actions as any} />);

    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-icon-1")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-icon-2")).not.toBeInTheDocument();
  });

  test("renders multiple actions correctly", () => {
    const MockIcon1 = () => <div data-testid="mock-icon-1">Icon 1</div>;
    const MockIcon2 = () => <div data-testid="mock-icon-2">Icon 2</div>;

    const actions = [
      {
        icon: MockIcon1,
        tooltip: "Action 1",
        onClick: vi.fn(),
        isVisible: true,
      },
      {
        icon: MockIcon2,
        tooltip: "Action 2",
        onClick: vi.fn(),
        isVisible: true,
      },
    ];

    render(<IconBar actions={actions as any} />);

    expect(screen.getAllByTestId("tooltip")).toHaveLength(2);
    expect(screen.getByTestId("mock-icon-1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-icon-2")).toBeInTheDocument();
  });

  test("triggers onClick handler when button is clicked", async () => {
    const user = userEvent.setup();
    const MockIcon = () => <div data-testid="mock-icon">Icon</div>;
    const handleClick = vi.fn();

    const actions = [
      {
        icon: MockIcon,
        tooltip: "Action",
        onClick: handleClick,
        isVisible: true,
      },
    ];

    render(<IconBar actions={actions as any} />);

    const button = screen.getByTestId("button");
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("renders tooltip with correct content", () => {
    const MockIcon = () => <div data-testid="mock-icon">Icon</div>;

    const actions = [
      {
        icon: MockIcon,
        tooltip: "Test Tooltip",
        onClick: vi.fn(),
        isVisible: true,
      },
    ];

    render(<IconBar actions={actions as any} />);

    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toHaveAttribute("data-tooltip", "Test Tooltip");
  });

  test("sets aria-label on button correctly", () => {
    const MockIcon = () => <div data-testid="mock-icon">Icon</div>;

    const actions = [
      {
        icon: MockIcon,
        tooltip: "Test Tooltip",
        onClick: vi.fn(),
        isVisible: true,
      },
    ];

    render(<IconBar actions={actions as any} />);

    const button = screen.getByTestId("button");
    expect(button).toHaveAttribute("aria-label", "Test Tooltip");
  });
});
