import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DecrementQuotasCheckbox } from "./index";

// Mock the Checkbox component
vi.mock("@/modules/ui/components/checkbox", () => ({
  Checkbox: ({ className, checked, onCheckedChange, id, type }: any) => (
    <button
      data-testid="checkbox"
      className={className}
      data-checked={checked}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}
      id={id}
      type={type}
    />
  ),
}));

describe("DecrementQuotasCheckbox", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with title and translated text", () => {
    render(<DecrementQuotasCheckbox title="Test Title" checked={false} onCheckedChange={vi.fn()} />);

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.responses.decrement_quotas")).toBeInTheDocument();
  });

  test("renders checkbox as unchecked when checked prop is false", () => {
    render(<DecrementQuotasCheckbox title="Test Title" checked={false} onCheckedChange={vi.fn()} />);

    const checkbox = screen.getByTestId("checkbox");
    expect(checkbox).toHaveAttribute("data-checked", "false");
  });

  test("calls onCheckedChange when checkbox is clicked", async () => {
    const handleCheckedChange = vi.fn();
    const user = userEvent.setup();

    render(
      <DecrementQuotasCheckbox title="Test Title" checked={false} onCheckedChange={handleCheckedChange} />
    );

    const checkbox = screen.getByTestId("checkbox");
    await user.click(checkbox);

    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  test("calls onCheckedChange with false when checked checkbox is clicked", async () => {
    const handleCheckedChange = vi.fn();
    const user = userEvent.setup();

    render(
      <DecrementQuotasCheckbox title="Test Title" checked={true} onCheckedChange={handleCheckedChange} />
    );

    const checkbox = screen.getByTestId("checkbox");
    await user.click(checkbox);

    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenCalledWith(false);
  });
});
