import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ColorSurveyBg } from "./color-survey-bg";

// Mock the ColorPicker component
vi.mock("@/modules/ui/components/color-picker", () => ({
  ColorPicker: ({ color, onChange }: { color: string; onChange?: (color: string) => void }) => (
    <div data-testid="color-picker" data-color={color}>
      Mocked ColorPicker
      {onChange && (
        <button data-testid="color-picker-change" onClick={() => onChange("#ABCDEF")}>
          Change Color
        </button>
      )}
      {onChange && (
        <button data-testid="simulate-color-change" onClick={() => onChange("invalid-color")}>
          Change Invalid Color
        </button>
      )}
    </div>
  ),
}));

describe("ColorSurveyBg", () => {
  const mockHandleBgChange = vi.fn();
  const mockColors = ["#FF0000", "#00FF00", "#0000FF"];

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("initializes color state with provided background prop", () => {
    const testBackground = "#123456";

    render(
      <ColorSurveyBg handleBgChange={mockHandleBgChange} colors={mockColors} background={testBackground} />
    );

    // Check if ColorPicker received the correct color prop
    const colorPicker = screen.getByTestId("color-picker");
    expect(colorPicker).toHaveAttribute("data-color", testBackground);
  });

  test("initializes color state with default #FFFFFF when background prop is not provided", () => {
    render(
      <ColorSurveyBg
        handleBgChange={mockHandleBgChange}
        colors={mockColors}
        background={undefined as unknown as string}
      />
    );

    // Check if ColorPicker received the default color
    const colorPicker = screen.getByTestId("color-picker");
    expect(colorPicker).toHaveAttribute("data-color", "#FFFFFF");
  });

  test("should update color state and call handleBgChange when a color is selected from ColorPicker", async () => {
    const user = userEvent.setup();
    const initialBackground = "#123456";

    render(
      <ColorSurveyBg handleBgChange={mockHandleBgChange} colors={mockColors} background={initialBackground} />
    );

    // Verify initial state
    const colorPicker = screen.getByTestId("color-picker");
    expect(colorPicker).toHaveAttribute("data-color", initialBackground);

    // Simulate color change from ColorPicker
    const changeButton = screen.getByTestId("color-picker-change");
    await user.click(changeButton);

    // Verify handleBgChange was called with the new color and 'color' type
    expect(mockHandleBgChange).toHaveBeenCalledWith("#ABCDEF", "color");

    // Verify color state was updated (ColorPicker should receive the new color)
    expect(colorPicker).toHaveAttribute("data-color", "#ABCDEF");
  });

  test("applies border style to the currently selected color box", () => {
    const selectedColor = "#00FF00"; // Second color in the mockColors array

    const { container } = render(
      <ColorSurveyBg handleBgChange={mockHandleBgChange} colors={mockColors} background={selectedColor} />
    );

    // Get all color boxes using CSS selector
    const colorBoxes = container.querySelectorAll(".h-16.w-16.cursor-pointer");
    expect(colorBoxes).toHaveLength(mockColors.length);

    // Find the selected color box (should be the second one)
    const selectedColorBox = colorBoxes[1];

    // Check that the selected color box has the border classes
    expect(selectedColorBox.className).toContain("border-4");
    expect(selectedColorBox.className).toContain("border-slate-500");

    // Check that other color boxes don't have these classes
    expect(colorBoxes[0].className).not.toContain("border-4");
    expect(colorBoxes[0].className).not.toContain("border-slate-500");
    expect(colorBoxes[2].className).not.toContain("border-4");
    expect(colorBoxes[2].className).not.toContain("border-slate-500");
  });

  test("renders all color boxes provided in the colors prop", () => {
    const testBackground = "#FF0000";

    const { container } = render(
      <ColorSurveyBg handleBgChange={mockHandleBgChange} colors={mockColors} background={testBackground} />
    );

    // Check if all color boxes are rendered using class selectors
    const colorBoxes = container.querySelectorAll(".h-16.w-16.cursor-pointer.rounded-lg");
    expect(colorBoxes).toHaveLength(mockColors.length);

    // Verify each color box has the correct background color
    mockColors.forEach((color, index) => {
      expect(colorBoxes[index]).toHaveStyle({ backgroundColor: color });
    });

    // Check that the selected color has the special border styling
    const selectedColorBox = colorBoxes[0]; // First color (#FF0000) should be selected
    expect(selectedColorBox.className).toContain("border-4 border-slate-500");

    // Check that non-selected colors don't have the special border styling
    const nonSelectedColorBoxes = Array.from(colorBoxes).slice(1);
    nonSelectedColorBoxes.forEach((box) => {
      expect(box.className).not.toContain("border-4 border-slate-500");
    });
  });

  test("renders without crashing when an invalid color format is provided", () => {
    const invalidColor = "invalid-color";
    const invalidColorsMock = ["#FF0000", "#00FF00", "invalid-color"];

    const { container } = render(
      <ColorSurveyBg
        handleBgChange={mockHandleBgChange}
        colors={invalidColorsMock}
        background={invalidColor}
      />
    );

    // Check if component renders without crashing
    expect(screen.getByTestId("color-picker")).toBeInTheDocument();

    // Check if ColorPicker received the invalid color
    expect(screen.getByTestId("color-picker")).toHaveAttribute("data-color", invalidColor);

    // Check if the color boxes render
    const colorBoxes = container.querySelectorAll(".h-16.w-16.cursor-pointer");
    expect(colorBoxes.length).toBe(3);
  });

  test("passes invalid color to handleBgChange when selected through ColorPicker", async () => {
    const user = userEvent.setup();
    const invalidColorsMock = ["#FF0000", "#00FF00", "invalid-color"];

    render(
      <ColorSurveyBg handleBgChange={mockHandleBgChange} colors={invalidColorsMock} background="#FFFFFF" />
    );

    // Simulate color change in ColorPicker with invalid color
    await user.click(screen.getByTestId("simulate-color-change"));

    // Verify handleBgChange was called with the invalid color
    expect(mockHandleBgChange).toHaveBeenCalledWith("invalid-color", "color");
  });

  test("passes invalid color to handleBgChange when clicking a color box with invalid color", async () => {
    const user = userEvent.setup();
    const invalidColorsMock = ["#FF0000", "#00FF00", "invalid-color"];

    const { container } = render(
      <ColorSurveyBg handleBgChange={mockHandleBgChange} colors={invalidColorsMock} background="#FFFFFF" />
    );

    // Find all color boxes
    const colorBoxes = container.querySelectorAll(".h-16.w-16.cursor-pointer");

    // The third box corresponds to our invalid color (from invalidColorsMock)
    const invalidColorBox = colorBoxes[2];
    expect(invalidColorBox).toBeInTheDocument();

    // Click the invalid color box
    await user.click(invalidColorBox);

    // Verify handleBgChange was called with the invalid color
    expect(mockHandleBgChange).toHaveBeenCalledWith("invalid-color", "color");
  });
});
