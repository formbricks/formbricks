import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { PasswordInput } from "./index";

describe("PasswordInput", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders password input with type password by default", () => {
    render(<PasswordInput placeholder="Enter password" />);

    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  test("toggles password visibility when eye icon is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Enter password" />);

    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toHaveAttribute("type", "password");

    // Find and click the toggle button (eye icon)
    const toggleButton = screen.getByRole("button");
    await user.click(toggleButton);

    // Check if input type changed to text
    expect(input).toHaveAttribute("type", "text");

    // Click the toggle button again
    await user.click(toggleButton);

    // Check if input type changed back to password
    expect(input).toHaveAttribute("type", "password");
  });

  test("applies custom className to input", () => {
    render(<PasswordInput className="custom-input-class" placeholder="Enter password" />);

    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toHaveClass("custom-input-class");
  });

  test("applies custom containerClassName", () => {
    render(<PasswordInput containerClassName="custom-container-class" placeholder="Enter password" />);

    const container = screen.getByPlaceholderText("Enter password").parentElement;
    expect(container).toHaveClass("custom-container-class");
  });

  test("passes through other HTML input attributes", () => {
    render(
      <PasswordInput placeholder="Enter password" id="password-field" name="password" required disabled />
    );

    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toHaveAttribute("id", "password-field");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("required");
    expect(input).toBeDisabled();
  });

  test("displays EyeIcon when password is hidden", () => {
    render(<PasswordInput placeholder="Enter password" />);

    const eyeIcon = document.querySelector("svg");
    expect(eyeIcon).toBeInTheDocument();

    // This is a simple check for the presence of the icon
    // We can't easily test the exact Lucide icon type in this setup
  });

  test("toggle button is of type button to prevent form submission", () => {
    render(<PasswordInput placeholder="Enter password" />);

    const toggleButton = screen.getByRole("button");
    expect(toggleButton).toHaveAttribute("type", "button");
  });
});
