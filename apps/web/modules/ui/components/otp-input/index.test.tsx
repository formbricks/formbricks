import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OTPInput } from "./index";

describe("OTPInput", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correct number of input fields", () => {
    const onChange = vi.fn();
    render(<OTPInput value="" valueLength={6} onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  test("displays provided value correctly", () => {
    const onChange = vi.fn();
    render(<OTPInput value="123456" valueLength={6} onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("1");
    expect(inputs[1]).toHaveValue("2");
    expect(inputs[2]).toHaveValue("3");
    expect(inputs[3]).toHaveValue("4");
    expect(inputs[4]).toHaveValue("5");
    expect(inputs[5]).toHaveValue("6");
  });

  test("applies custom container class", () => {
    const onChange = vi.fn();
    render(
      <OTPInput value="" valueLength={4} onChange={onChange} containerClassName="test-container-class" />
    );

    const container = screen.getAllByRole("textbox")[0].parentElement;
    expect(container).toHaveClass("test-container-class");
  });

  test("applies custom input box class", () => {
    const onChange = vi.fn();
    render(<OTPInput value="" valueLength={4} onChange={onChange} inputBoxClassName="test-input-class" />);

    const inputs = screen.getAllByRole("textbox");
    inputs.forEach((input) => {
      expect(input).toHaveClass("test-input-class");
    });
  });

  test("disables inputs when disabled prop is true", () => {
    const onChange = vi.fn();
    render(<OTPInput value="" valueLength={4} onChange={onChange} disabled={true} />);

    const inputs = screen.getAllByRole("textbox");
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  test("calls onChange with updated value when input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OTPInput value="123" valueLength={4} onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox");
    await user.click(inputs[3]);
    await user.keyboard("4");

    expect(onChange).toHaveBeenCalledWith("1234");
  });

  test("only accepts digit inputs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OTPInput value="" valueLength={4} onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox");
    await user.click(inputs[0]);
    await user.keyboard("a");

    expect(onChange).not.toHaveBeenCalled();
  });

  test("moves focus to next input after entering a digit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OTPInput value="" valueLength={4} onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox");
    await user.click(inputs[0]);
    await user.keyboard("1");

    expect(document.activeElement).toBe(inputs[1]);
  });

  test("navigates inputs with arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OTPInput value="1234" valueLength={4} onChange={onChange} />);

    const inputs = screen.getAllByRole("textbox");
    await user.click(inputs[1]); // Focus on the 2nd input

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(inputs[2]);

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(inputs[1]);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(inputs[2]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(inputs[1]);
  });
});
