import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "./index";

describe("Alert Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders basic default alert correctly", () => {
    render(<Alert>This is an alert</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("This is an alert")).toBeInTheDocument();
  });

  test("renders alert with title and description", () => {
    render(
      <Alert>
        <AlertTitle>Alert Title</AlertTitle>
        <AlertDescription>This is an alert description</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alert Title" })).toBeInTheDocument();
    expect(screen.getByText("This is an alert description")).toBeInTheDocument();
  });

  test("renders error variant correctly", () => {
    render(
      <Alert variant="error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>This is an error alert</AlertDescription>
      </Alert>
    );

    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveClass("text-error-foreground");
    expect(alertElement).toHaveClass("border-error/50");
  });

  test("renders warning variant correctly", () => {
    render(
      <Alert variant="warning">
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>This is a warning alert</AlertDescription>
      </Alert>
    );

    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveClass("text-warning-foreground");
    expect(alertElement).toHaveClass("border-warning/50");
  });

  test("renders info variant correctly", () => {
    render(
      <Alert variant="info">
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>This is an info alert</AlertDescription>
      </Alert>
    );

    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveClass("text-info-foreground");
    expect(alertElement).toHaveClass("border-info/50");
  });

  test("renders success variant correctly", () => {
    render(
      <Alert variant="success">
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>This is a success alert</AlertDescription>
      </Alert>
    );

    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveClass("text-success-foreground");
    expect(alertElement).toHaveClass("border-success/50");
  });

  test("renders small size correctly", () => {
    render(
      <Alert size="small">
        <AlertTitle>Small Alert</AlertTitle>
        <AlertDescription>This is a small alert</AlertDescription>
      </Alert>
    );

    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveClass("px-4 py-2 text-xs flex items-center gap-2");
  });

  test("renders AlertButton correctly and handles click", async () => {
    const handleClick = vi.fn();
    render(
      <Alert>
        <AlertTitle>Alert with Button</AlertTitle>
        <AlertDescription>This alert has a button</AlertDescription>
        <AlertButton onClick={handleClick}>Dismiss</AlertButton>
      </Alert>
    );

    const button = screen.getByRole("button", { name: "Dismiss" });
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("renders AlertButton with small alert correctly", () => {
    render(
      <Alert size="small">
        <AlertTitle>Small Alert with Button</AlertTitle>
        <AlertDescription>This small alert has a button</AlertDescription>
        <AlertButton>Action</AlertButton>
      </Alert>
    );

    const button = screen.getByRole("button", { name: "Action" });
    expect(button).toBeInTheDocument();

    // Check that the button container has the correct positioning class for small alerts
    const buttonContainer = button.parentElement;
    expect(buttonContainer).toHaveClass("-my-2 -mr-4 ml-auto flex-shrink-0");
  });

  test("renders alert with custom className", () => {
    render(<Alert className="my-custom-class">Custom Alert</Alert>);

    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveClass("my-custom-class");
  });
});
