import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Button, buttonVariants } from "./index";

describe("Button", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders button with children", () => {
    render(<Button>Test Button</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Test Button");
  });

  test("applies correct variant classes", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary", "text-primary-foreground");

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive", "text-destructive-foreground");

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole("button")).toHaveClass("border", "border-input", "bg-background");

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-secondary", "text-secondary-foreground");

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-primary");

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-primary");
  });

  test("applies correct size classes", () => {
    const { rerender } = render(<Button size="default">Default Size</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9", "px-4", "py-2");

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8", "px-3", "text-xs");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10", "px-8");

    rerender(<Button size="icon">Icon</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9", "w-9");
  });

  test("renders as a different element when asChild is true", () => {
    const CustomButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
      (props, ref) => <span ref={ref} {...props} />
    );
    CustomButton.displayName = "CustomButton";

    render(
      <Button asChild>
        <CustomButton>Custom Element</CustomButton>
      </Button>
    );

    expect(screen.getByText("Custom Element").tagName).toBe("SPAN");
  });

  test("renders in loading state", () => {
    render(<Button loading>Loading</Button>);

    const buttonElement = screen.getByRole("button");
    expect(buttonElement).toHaveClass("cursor-not-allowed", "opacity-50");
    expect(buttonElement).toBeDisabled();

    const loaderIcon = buttonElement.querySelector("svg");
    expect(loaderIcon).toBeInTheDocument();
    expect(loaderIcon).toHaveClass("animate-spin");
  });

  test("applies custom className", () => {
    render(<Button className="custom-class">Custom Class</Button>);
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  test("forwards additional props to the button element", () => {
    render(
      <Button type="submit" data-testid="submit-button">
        Submit
      </Button>
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
  });

  test("can be disabled", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  test("calls onClick handler when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click Me</Button>);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("doesn't call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Button onClick={handleClick} disabled>
        Disabled Button
      </Button>
    );

    await user.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test("buttonVariants function applies correct classes", () => {
    const classes = buttonVariants({ variant: "destructive", size: "lg", className: "custom" });

    expect(classes).toContain("bg-destructive");
    expect(classes).toContain("text-destructive-foreground");
    expect(classes).toContain("h-10");
    expect(classes).toContain("rounded-md");
    expect(classes).toContain("px-8");
    expect(classes).toContain("custom");
  });

  test("buttonVariants function works with no parameters", () => {
    const classes = buttonVariants();

    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
    expect(classes).toContain("h-9");
    expect(classes).toContain("px-4");
  });
});
