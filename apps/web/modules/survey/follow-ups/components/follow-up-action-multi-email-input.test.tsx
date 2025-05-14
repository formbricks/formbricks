import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import FollowUpActionMultiEmailInput from "./follow-up-action-multi-email-input";

describe("FollowUpActionMultiEmailInput", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders empty input initially", () => {
    const setEmails = vi.fn();
    render(<FollowUpActionMultiEmailInput emails={[]} setEmails={setEmails} />);

    const input = screen.getByPlaceholderText("Write an email & press space bar");
    expect(input).toBeInTheDocument();
  });

  test("adds valid email when pressing space", async () => {
    const setEmails = vi.fn();
    const user = userEvent.setup();

    render(<FollowUpActionMultiEmailInput emails={[]} setEmails={setEmails} />);

    const input = screen.getByPlaceholderText("Write an email & press space bar");
    await user.type(input, "test@example.com ");

    expect(setEmails).toHaveBeenCalledWith(["test@example.com"]);
  });

  test("shows error for invalid email", async () => {
    const setEmails = vi.fn();
    const user = userEvent.setup();

    render(<FollowUpActionMultiEmailInput emails={[]} setEmails={setEmails} />);

    const input = screen.getByPlaceholderText("Write an email & press space bar");
    await user.type(input, "invalid-email ");

    expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
    expect(setEmails).not.toHaveBeenCalled();
  });

  test("shows error for duplicate email", async () => {
    const setEmails = vi.fn();
    const user = userEvent.setup();

    render(<FollowUpActionMultiEmailInput emails={["test@example.com"]} setEmails={setEmails} />);

    const input = screen.getByPlaceholderText("");
    await user.type(input, "test@example.com ");

    expect(screen.getByText("This email has already been added")).toBeInTheDocument();
    expect(setEmails).not.toHaveBeenCalled();
  });

  test("removes email when clicking remove button", async () => {
    const setEmails = vi.fn();
    const user = userEvent.setup();

    render(<FollowUpActionMultiEmailInput emails={["test@example.com"]} setEmails={setEmails} />);

    const removeButton = screen.getByText("×");
    await user.click(removeButton);

    expect(setEmails).toHaveBeenCalledWith([]);
  });

  test("removes last email when pressing backspace on empty input", async () => {
    const setEmails = vi.fn();
    const user = userEvent.setup();

    render(<FollowUpActionMultiEmailInput emails={["test@example.com"]} setEmails={setEmails} />);

    const input = screen.getByPlaceholderText("");
    await user.type(input, "{backspace}");

    expect(setEmails).toHaveBeenCalledWith([]);
  });

  test("shows red border when isInvalid is true", () => {
    const setEmails = vi.fn();
    render(<FollowUpActionMultiEmailInput emails={[]} setEmails={setEmails} isInvalid={true} />);

    const container = screen.getByRole("textbox").parentElement;
    expect(container).toHaveClass("border-red-500");
  });

  test("adds email on blur if input is not empty", async () => {
    const setEmails = vi.fn();
    const user = userEvent.setup();

    render(<FollowUpActionMultiEmailInput emails={[]} setEmails={setEmails} />);

    const input = screen.getByPlaceholderText("Write an email & press space bar");
    await user.type(input, "test@example.com");
    await user.tab();

    expect(setEmails).toHaveBeenCalledWith(["test@example.com"]);
  });

  test("clears error when typing after error is shown", async () => {
    const setEmails = vi.fn();
    const user = userEvent.setup();

    render(<FollowUpActionMultiEmailInput emails={[]} setEmails={setEmails} />);

    const input = screen.getByPlaceholderText("Write an email & press space bar");
    await user.type(input, "invalid-email ");
    expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();

    await user.type(input, "a");
    expect(screen.queryByText("Please enter a valid email address")).not.toBeInTheDocument();
  });
});
