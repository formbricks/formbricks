import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PopoverPicker } from "./popover-picker";

// Mock useClickOutside hook
vi.mock("@/lib/utils/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn((ref, callback) => {
    // Store callback to trigger it in tests
    if (ref.current && callback) {
      (ref.current as any)._closeCallback = callback;
    }
  }),
}));

// Mock HexColorPicker component
vi.mock("react-colorful", () => ({
  HexColorPicker: ({ color, onChange }: { color: string; onChange: (color: string) => void }) => (
    <div data-testid="hex-color-picker" data-color={color} onClick={() => onChange("#000000")}>
      Color Picker Mock
    </div>
  ),
}));

describe("PopoverPicker", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders color block with correct background color", () => {
    const mockColor = "#ff0000";
    const mockOnChange = vi.fn();

    render(<PopoverPicker color={mockColor} onChange={mockOnChange} />);

    const colorBlock = document.getElementById("color-picker");
    expect(colorBlock).toBeInTheDocument();
    expect(colorBlock).toHaveStyle({ backgroundColor: mockColor });
  });

  test("opens color picker when color block is clicked", async () => {
    const mockColor = "#ff0000";
    const mockOnChange = vi.fn();
    const user = userEvent.setup();

    render(<PopoverPicker color={mockColor} onChange={mockOnChange} />);

    // Picker should be closed initially
    expect(screen.queryByTestId("hex-color-picker")).not.toBeInTheDocument();

    // Click color block to open picker
    const colorBlock = document.getElementById("color-picker");
    await user.click(colorBlock!);

    // Picker should be open now
    expect(screen.getByTestId("hex-color-picker")).toBeInTheDocument();
  });

  test("calls onChange when a color is selected", async () => {
    const mockColor = "#ff0000";
    const mockOnChange = vi.fn();
    const user = userEvent.setup();

    render(<PopoverPicker color={mockColor} onChange={mockOnChange} />);

    // Click to open the picker
    const colorBlock = document.getElementById("color-picker");
    await user.click(colorBlock!);

    // Click on the color picker to select a color
    const colorPicker = screen.getByTestId("hex-color-picker");
    await user.click(colorPicker);

    // OnChange should have been called with the new color (#000000 from our mock)
    expect(mockOnChange).toHaveBeenCalledWith("#000000");
  });

  test("shows color block as disabled when disabled prop is true", () => {
    const mockColor = "#ff0000";
    const mockOnChange = vi.fn();

    render(<PopoverPicker color={mockColor} onChange={mockOnChange} disabled={true} />);

    const colorBlock = document.getElementById("color-picker");
    expect(colorBlock).toBeInTheDocument();
    expect(colorBlock).toHaveStyle({ opacity: 0.5 });
  });

  test("doesn't open picker when disabled and clicked", async () => {
    const mockColor = "#ff0000";
    const mockOnChange = vi.fn();
    const user = userEvent.setup();

    render(<PopoverPicker color={mockColor} onChange={mockOnChange} disabled={true} />);

    // Click the disabled color block
    const colorBlock = document.getElementById("color-picker");
    await user.click(colorBlock!);

    // Picker should remain closed
    expect(screen.queryByTestId("hex-color-picker")).not.toBeInTheDocument();
  });
});
