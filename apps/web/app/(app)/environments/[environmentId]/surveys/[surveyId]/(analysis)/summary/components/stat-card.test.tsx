import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StatCard } from "./stat-card";

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/base-card",
  () => ({
    BaseCard: ({
      label,
      percentage,
      tooltipText,
      isLoading,
      children,
    }: {
      label: React.ReactNode;
      percentage?: number | null;
      tooltipText?: React.ReactNode;
      isLoading?: boolean;
      children: React.ReactNode;
    }) => (
      <div data-testid="base-card">
        <div data-testid="base-card-label">{label}</div>
        {percentage !== null && percentage !== undefined && (
          <div data-testid="base-card-percentage">{percentage}%</div>
        )}
        {tooltipText && <div data-testid="base-card-tooltip">{tooltipText}</div>}
        <div data-testid="base-card-loading">{isLoading ? "loading" : "not-loading"}</div>
        <div data-testid="base-card-children">{children}</div>
      </div>
    ),
  })
);

describe("StatCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with basic props", () => {
    render(<StatCard label="Test Label" value="Test Value" />);

    expect(screen.getByTestId("base-card")).toBeInTheDocument();
    expect(screen.getByTestId("base-card-label")).toHaveTextContent("Test Label");
    expect(screen.getByTestId("base-card-loading")).toHaveTextContent("not-loading");
    expect(screen.getByText("Test Value")).toBeInTheDocument();
  });

  test("passes percentage prop to BaseCard", () => {
    render(<StatCard label="Test Label" value="Test Value" percentage={75} />);

    expect(screen.getByTestId("base-card-percentage")).toHaveTextContent("75%");
  });

  test("renders loading state with skeleton", () => {
    render(<StatCard label="Test Label" value="Test Value" isLoading={true} />);

    expect(screen.getByTestId("base-card-loading")).toHaveTextContent("loading");

    const skeleton = screen.getByTestId("base-card-children").querySelector("div");
    expect(skeleton).toHaveClass("h-6", "w-12", "animate-pulse", "rounded-full", "bg-slate-200");

    expect(screen.queryByText("Test Value")).not.toBeInTheDocument();
  });

  test("renders value when not loading", () => {
    render(<StatCard label="Test Label" value="Test Value" isLoading={false} />);

    expect(screen.getByTestId("base-card-loading")).toHaveTextContent("not-loading");
    expect(screen.getByText("Test Value")).toBeInTheDocument();
    expect(screen.getByText("Test Value")).toHaveClass("text-2xl", "font-bold", "text-slate-800");
  });

  test("renders dash value correctly", () => {
    const dashValue = <span>-</span>;
    render(<StatCard label="Test Label" value={dashValue} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
