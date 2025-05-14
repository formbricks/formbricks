import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ColorPicker } from "./index";

// Mock the HexColorInput component
vi.mock("react-colorful", () => ({
  HexColorInput: ({
    color,
    onChange,
    disabled,
  }: {
    color: string;
    onChange: (color: string) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="hex-color-input"
      value={color}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Primary color"
    />
  ),
  HexColorPicker: vi.fn(),
}));

// Mock the PopoverPicker component
vi.mock("@/modules/ui/components/color-picker/components/popover-picker", () => ({
  PopoverPicker: ({
    color,
    onChange,
    disabled,
  }: {
    color: string;
    onChange: (color: string) => void;
    disabled?: boolean;
  }) => (
    <div
      data-testid="popover-picker"
      data-color={color}
      data-disabled={disabled}
      onClick={() => onChange("#000000")}>
      Popover Picker Mock
    </div>
  ),
}));

describe("ColorPicker", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with provided color", () => {
    const mockColor = "ff0000";
    const mockOnChange = vi.fn();

    render(<ColorPicker color={mockColor} onChange={mockOnChange} />);

    const input = screen.getByTestId("hex-color-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(mockColor);

    const popoverPicker = screen.getByTestId("popover-picker");
    expect(popoverPicker).toBeInTheDocument();
    expect(popoverPicker).toHaveAttribute("data-color", mockColor);
  });

  test("applies custom container class when provided", () => {
    const mockColor = "ff0000";
    const mockOnChange = vi.fn();
    const customClass = "my-custom-class";

    render(<ColorPicker color={mockColor} onChange={mockOnChange} containerClass={customClass} />);

    const container = document.querySelector(`.${customClass}`);
    expect(container).toBeInTheDocument();
  });

  test("passes disabled state to both input and popover picker", () => {
    const mockColor = "ff0000";
    const mockOnChange = vi.fn();

    render(<ColorPicker color={mockColor} onChange={mockOnChange} disabled={true} />);

    const input = screen.getByTestId("hex-color-input");
    expect(input).toHaveAttribute("disabled");

    const popoverPicker = screen.getByTestId("popover-picker");
    expect(popoverPicker).toHaveAttribute("data-disabled", "true");
  });

  test("calls onChange when input value changes", async () => {
    const mockColor = "ff0000";
    const mockOnChange = vi.fn();
    const user = userEvent.setup();

    render(<ColorPicker color={mockColor} onChange={mockOnChange} />);

    const input = screen.getByTestId("hex-color-input");
    await user.type(input, "abc123");

    // The onChange from the HexColorInput would be called
    // In a real scenario, this would be tested differently, but our mock simulates the onChange event
    expect(mockOnChange).toHaveBeenCalled();
  });

  test("calls onChange when popover picker changes", async () => {
    const mockColor = "ff0000";
    const mockOnChange = vi.fn();
    const user = userEvent.setup();

    render(<ColorPicker color={mockColor} onChange={mockOnChange} />);

    const popoverPicker = screen.getByTestId("popover-picker");
    await user.click(popoverPicker);

    // Our mock simulates changing to #000000
    expect(mockOnChange).toHaveBeenCalledWith("#000000");
  });
});
