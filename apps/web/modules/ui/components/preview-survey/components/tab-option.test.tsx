import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TabOption } from "./tab-option";

describe("TabOption", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with active state", () => {
    render(<TabOption active={true} icon={<span data-testid="test-icon">Icon</span>} onClick={() => {}} />);

    const tabElement = screen.getByTestId("test-icon").parentElement;
    expect(tabElement).toBeInTheDocument();
    expect(tabElement).toHaveClass("rounded-full");
    expect(tabElement).toHaveClass("bg-slate-200");
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  test("renders with inactive state", () => {
    render(<TabOption active={false} icon={<span data-testid="test-icon">Icon</span>} onClick={() => {}} />);

    const tabElement = screen.getByTestId("test-icon").parentElement;
    expect(tabElement).toBeInTheDocument();
    expect(tabElement).not.toHaveClass("rounded-full");
    expect(tabElement).not.toHaveClass("bg-slate-200");
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  test("calls onClick handler when clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <TabOption active={false} icon={<span data-testid="test-icon">Icon</span>} onClick={handleClick} />
    );

    const tabElement = screen.getByTestId("test-icon").parentElement;
    await user.click(tabElement!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("renders children (icon) properly", () => {
    render(
      <TabOption
        active={false}
        icon={
          <div data-testid="complex-icon">
            <span>Nested Icon</span>
          </div>
        }
        onClick={() => {}}
      />
    );

    expect(screen.getByTestId("complex-icon")).toBeInTheDocument();
    expect(screen.getByText("Nested Icon")).toBeInTheDocument();
  });
});
