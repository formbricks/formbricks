import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AdvancedOptionToggle } from "./index";

describe("AdvancedOptionToggle Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders basic component with required props", () => {
    const onToggle = vi.fn();
    render(
      <AdvancedOptionToggle
        isChecked={false}
        onToggle={onToggle}
        htmlId="test-toggle"
        title="Test Title"
        description="Test Description"
      />
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  test("calls onToggle when switch is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <AdvancedOptionToggle
        isChecked={false}
        onToggle={onToggle}
        htmlId="test-toggle"
        title="Test Title"
        description="Test Description"
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("switch"));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  test("renders children when isChecked is true", () => {
    render(
      <AdvancedOptionToggle
        isChecked={true}
        onToggle={vi.fn()}
        htmlId="test-toggle"
        title="Test Title"
        description="Test Description">
        <div data-testid="child-content">Child Content</div>
      </AdvancedOptionToggle>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  test("does not render children when isChecked is false", () => {
    render(
      <AdvancedOptionToggle
        isChecked={false}
        onToggle={vi.fn()}
        htmlId="test-toggle"
        title="Test Title"
        description="Test Description">
        <div data-testid="child-content">Child Content</div>
      </AdvancedOptionToggle>
    );

    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
  });

  test("applies childBorder class when childBorder prop is true", () => {
    render(
      <AdvancedOptionToggle
        isChecked={true}
        onToggle={vi.fn()}
        htmlId="test-toggle"
        title="Test Title"
        description="Test Description"
        childBorder={true}>
        <div data-testid="child-content">Child Content</div>
      </AdvancedOptionToggle>
    );

    const childContainer = screen.getByTestId("child-content").parentElement;
    expect(childContainer).toHaveClass("border");
  });

  test("disables the switch when disabled prop is true", () => {
    render(
      <AdvancedOptionToggle
        isChecked={false}
        onToggle={vi.fn()}
        htmlId="test-toggle"
        title="Test Title"
        description="Test Description"
        disabled={true}
      />
    );

    expect(screen.getByRole("switch")).toBeDisabled();
  });

  test("switch is checked when isChecked prop is true", () => {
    render(
      <AdvancedOptionToggle
        isChecked={true}
        onToggle={vi.fn()}
        htmlId="test-toggle"
        title="Test Title"
        description="Test Description"
      />
    );

    expect(screen.getByRole("switch")).toBeChecked();
  });
});
