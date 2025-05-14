import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OptionCard } from "./index";

vi.mock("@/modules/ui/components/loading-spinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading Spinner</div>,
}));

describe("OptionCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with small size correctly", () => {
    render(<OptionCard size="sm" title="Test Title" description="Test Description" />);

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();

    const card = screen.getByRole("button");
    expect(card).toHaveClass("p-4", "rounded-lg", "w-60", "shadow-md");
  });

  test("renders with medium size correctly", () => {
    render(<OptionCard size="md" title="Test Title" description="Test Description" />);

    const card = screen.getByRole("button");
    expect(card).toHaveClass("p-6", "rounded-xl", "w-80", "shadow-lg");
  });

  test("renders with large size correctly", () => {
    render(<OptionCard size="lg" title="Test Title" description="Test Description" />);

    const card = screen.getByRole("button");
    expect(card).toHaveClass("p-8", "rounded-2xl", "w-100", "shadow-xl");
  });

  test("displays loading spinner when loading is true", () => {
    render(<OptionCard size="md" title="Test Title" description="Test Description" loading={true} />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  test("does not display loading spinner when loading is false", () => {
    render(<OptionCard size="md" title="Test Title" description="Test Description" loading={false} />);

    expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
  });

  test("calls onSelect when clicked", async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <OptionCard size="md" title="Test Title" description="Test Description" onSelect={handleSelect} />
    );

    await user.click(screen.getByRole("button"));
    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  test("renders with custom cssId", () => {
    render(<OptionCard size="md" title="Test Title" description="Test Description" cssId="custom-id" />);

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("id", "custom-id");
  });

  test("renders children correctly", () => {
    render(
      <OptionCard size="md" title="Test Title" description="Test Description">
        <div data-testid="child-element">Child content</div>
      </OptionCard>
    );

    expect(screen.getByTestId("child-element")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});
