import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import FilterButton from "./filter-button";

describe("FilterButton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders icon and label", () => {
    render(
      <FilterButton icon={<span data-testid="icon">icon</span>} label="Test Label" onClick={() => {}} />
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  test("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<FilterButton icon={<span />} label="Click Me" onClick={onClick} />);
    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  test("calls onKeyDown when Enter or Space is pressed", async () => {
    const onKeyDown = vi.fn();
    render(<FilterButton icon={<span />} label="Key Test" onClick={() => {}} onKeyDown={onKeyDown} />);
    const button = screen.getByRole("button");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onKeyDown).toHaveBeenCalled();
    onKeyDown.mockClear();
    await userEvent.keyboard(" ");
    expect(onKeyDown).toHaveBeenCalled();
  });
});
