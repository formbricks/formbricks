import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "./index";

describe("Alert", () => {
  it("renders with default variant", () => {
    render(
      <Alert>
        <AlertTitle>Test Title</AlertTitle>
        <AlertDescription>Test Description</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("renders with different variants", () => {
    const variants = ["default", "error", "warning", "info", "success"] as const;

    variants.forEach((variant) => {
      const { container } = render(
        <Alert variant={variant}>
          <AlertTitle>Test Title</AlertTitle>
        </Alert>
      );

      expect(container.firstChild).toHaveClass(
        variant === "default" ? "text-foreground" : `text-${variant}-foreground`
      );
    });
  });

  it("renders with different sizes", () => {
    const sizes = ["default", "small"] as const;

    sizes.forEach((size) => {
      const { container } = render(
        <Alert size={size}>
          <AlertTitle>Test Title</AlertTitle>
        </Alert>
      );

      expect(container.firstChild).toHaveClass(size === "default" ? "py-3" : "py-2");
    });
  });

  it("renders with button and handles click", () => {
    const handleClick = vi.fn();

    render(
      <Alert>
        <AlertTitle>Test Title</AlertTitle>
        <AlertButton onClick={handleClick}>Click me</AlertButton>
      </Alert>
    );

    const button = screen.getByText("Click me");
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    const { container } = render(
      <Alert className="custom-class">
        <AlertTitle>Test Title</AlertTitle>
      </Alert>
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
