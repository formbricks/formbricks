import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { InteractiveCard } from "./interactive-card";

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/base-card",
  () => ({
    BaseCard: ({
      label,
      percentage,
      tooltipText,
      isLoading,
      onClick,
      testId,
      id,
      children,
    }: {
      label: React.ReactNode;
      percentage?: number | null;
      tooltipText?: React.ReactNode;
      isLoading?: boolean;
      onClick?: () => void;
      testId?: string;
      id?: string;
      children: React.ReactNode;
    }) => (
      <div data-testid="base-card" onClick={onClick}>
        <div data-testid="base-card-label">{label}</div>
        {percentage !== null && percentage !== undefined && (
          <div data-testid="base-card-percentage">{percentage}%</div>
        )}
        {tooltipText && <div data-testid="base-card-tooltip">{tooltipText}</div>}
        <div data-testid="base-card-loading">{isLoading ? "loading" : "not-loading"}</div>
        <div data-testid="base-card-testid">{testId}</div>
        <div data-testid="base-card-id">{id}</div>
        <div data-testid="base-card-children">{children}</div>
      </div>
    ),
  })
);

vi.mock("lucide-react", () => ({
  ChevronDownIcon: ({ className }: { className: string }) => (
    <div data-testid="chevron-down-icon" className={className}>
      ChevronDown
    </div>
  ),
  ChevronUpIcon: ({ className }: { className: string }) => (
    <div data-testid="chevron-up-icon" className={className}>
      ChevronUp
    </div>
  ),
}));

describe("InteractiveCard", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    tab: "dropOffs" as const,
    label: "Test Label",
    percentage: 75,
    value: "Test Value",
    tooltipText: "Test tooltip",
    isLoading: false,
    onClick: vi.fn(),
    isActive: false,
  };

  test("renders with basic props", () => {
    render(<InteractiveCard {...defaultProps} />);

    expect(screen.getByTestId("base-card")).toBeInTheDocument();
    expect(screen.getByTestId("base-card-label")).toHaveTextContent("Test Label");
    expect(screen.getByTestId("base-card-percentage")).toHaveTextContent("75%");
    expect(screen.getByTestId("base-card-tooltip")).toHaveTextContent("Test tooltip");
    expect(screen.getByTestId("base-card-loading")).toHaveTextContent("not-loading");
    expect(screen.getByText("Test Value")).toBeInTheDocument();
  });

  test("generates correct testId and id based on tab", () => {
    render(<InteractiveCard {...defaultProps} tab="quotas" />);

    expect(screen.getByTestId("base-card-testid")).toHaveTextContent("quotas-toggle");
    expect(screen.getByTestId("base-card-id")).toHaveTextContent("quotas-toggle");
  });

  test("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<InteractiveCard {...defaultProps} onClick={handleClick} />);

    await user.click(screen.getByTestId("base-card"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  test("renders loading state with skeleton", () => {
    render(<InteractiveCard {...defaultProps} isLoading={true} />);

    expect(screen.getByTestId("base-card-loading")).toHaveTextContent("loading");

    const skeleton = screen.getByTestId("base-card-children").querySelector(".animate-pulse");
    expect(skeleton).toHaveClass("h-6", "w-12", "animate-pulse", "rounded-full", "bg-slate-200");

    expect(screen.queryByText("Test Value")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chevron-down-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chevron-up-icon")).not.toBeInTheDocument();
  });

  test("shows chevron up icon when active", () => {
    render(<InteractiveCard {...defaultProps} isActive={true} />);

    expect(screen.getByTestId("chevron-up-icon")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-up-icon")).toHaveClass("h-4", "w-4");
    expect(screen.queryByTestId("chevron-down-icon")).not.toBeInTheDocument();
  });

  test("handles zero percentage", () => {
    render(<InteractiveCard {...defaultProps} percentage={0} />);

    expect(screen.getByTestId("base-card-percentage")).toHaveTextContent("0%");
  });
});
