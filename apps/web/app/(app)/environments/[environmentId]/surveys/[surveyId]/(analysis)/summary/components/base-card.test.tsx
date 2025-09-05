import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BaseCard } from "./base-card";

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({
    children,
    onClick,
    "data-testid": dataTestId,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "data-testid"?: string;
  }) => (
    <div data-testid="tooltip-trigger" onClick={onClick} data-testid-value={dataTestId}>
      {children}
    </div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

describe("BaseCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders basic card with label and children", () => {
    render(
      <BaseCard label="Test Label" tooltipText="Test tooltip">
        <div>Test Content</div>
      </BaseCard>
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
  });

  test("displays percentage when provided as valid number", () => {
    render(
      <BaseCard label="Test Label" percentage={75}>
        <div>Test Content</div>
      </BaseCard>
    );

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  test("does not display percentage when loading", () => {
    render(
      <BaseCard label="Test Label" percentage={75} isLoading={true}>
        <div>Test Content</div>
      </BaseCard>
    );

    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });

  test("calls onClick when card is clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <BaseCard label="Test Label" onClick={handleClick}>
        <div>Test Content</div>
      </BaseCard>
    );

    await user.click(screen.getByTestId("tooltip-trigger"));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
