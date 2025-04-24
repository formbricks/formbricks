import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { HalfCircle, ProgressBar } from ".";

describe("ProgressBar", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default height and correct progress", () => {
    const { container } = render(<ProgressBar progress={0.5} barColor="bg-blue-500" />);
    const outerDiv = container.firstChild as HTMLElement;
    const innerDiv = outerDiv.firstChild as HTMLElement;

    expect(outerDiv).toHaveClass("h-5"); // Default height
    expect(outerDiv).toHaveClass("w-full rounded-full bg-slate-200");
    expect(innerDiv).toHaveClass("h-full rounded-full bg-blue-500");
    expect(innerDiv.style.width).toBe("50%");
  });

  test("renders with specified height (h-2)", () => {
    const { container } = render(<ProgressBar progress={0.75} barColor="bg-green-500" height={2} />);
    const outerDiv = container.firstChild as HTMLElement;
    const innerDiv = outerDiv.firstChild as HTMLElement;

    expect(outerDiv).toHaveClass("h-2"); // Specified height
    expect(innerDiv).toHaveClass("bg-green-500");
    expect(innerDiv.style.width).toBe("75%");
  });

  test("caps progress at 100%", () => {
    const { container } = render(<ProgressBar progress={1.2} barColor="bg-red-500" />);
    const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(innerDiv.style.width).toBe("100%");
  });

  test("handles progress less than 0%", () => {
    const { container } = render(<ProgressBar progress={-0.1} barColor="bg-yellow-500" />);
    const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(innerDiv.style.width).toBe("0%");
  });

  test("applies barColor class", () => {
    const testColor = "bg-purple-600";
    const { container } = render(<ProgressBar progress={0.3} barColor={testColor} />);
    const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(innerDiv).toHaveClass(testColor);
  });
});

describe("HalfCircle", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with a given value", () => {
    const testValue = 50;
    const { getByText, container } = render(<HalfCircle value={testValue} />);

    // Check if boundary values and the main value are rendered
    expect(getByText("-100")).toBeInTheDocument();
    expect(getByText("100")).toBeInTheDocument();
    expect(getByText(Math.round(testValue).toString())).toBeInTheDocument();

    // Check rotation calculation: normalized = (50 + 100) / 200 = 0.75; mapped = (0.75 * 180 - 180) = -45deg
    const rotatingDiv = container.querySelector(".bg-brand-dark") as HTMLElement;
    expect(rotatingDiv).toBeInTheDocument();
    expect(rotatingDiv.style.rotate).toBe("-45deg");
  });

  test("renders correctly with value -100", () => {
    const testValue = -100;
    const { getAllByText, getByText, container } = render(<HalfCircle value={testValue} />);
    // Check boundary labels
    expect(getAllByText("-100")[0]).toBeInTheDocument();
    expect(getByText("100")).toBeInTheDocument();

    // Check the main value using a more specific selector
    const mainValueElement = container.querySelector(".text-2xl.text-black");
    expect(mainValueElement).toBeInTheDocument();
    expect(mainValueElement?.textContent).toBe(Math.round(testValue).toString());

    // normalized = (-100 + 100) / 200 = 0; mapped = (0 * 180 - 180) = -180deg
    const rotatingDiv = container.querySelector(".bg-brand-dark") as HTMLElement;
    expect(rotatingDiv.style.rotate).toBe("-180deg");
  });

  test("renders correctly with value 100", () => {
    const testValue = 100;
    const { getAllByText, container } = render(<HalfCircle value={testValue} />);
    expect(getAllByText(Math.round(testValue).toString())[0]).toBeInTheDocument();
    // normalized = (100 + 100) / 200 = 1; mapped = (1 * 180 - 180) = 0deg
    const rotatingDiv = container.querySelector(".bg-brand-dark") as HTMLElement;
    expect(rotatingDiv.style.rotate).toBe("0deg");
  });

  test("renders correctly with value 0", () => {
    const testValue = 0;
    const { getByText, container } = render(<HalfCircle value={testValue} />);
    expect(getByText(Math.round(testValue).toString())).toBeInTheDocument();
    // normalized = (0 + 100) / 200 = 0.5; mapped = (0.5 * 180 - 180) = -90deg
    const rotatingDiv = container.querySelector(".bg-brand-dark") as HTMLElement;
    expect(rotatingDiv.style.rotate).toBe("-90deg");
  });
});
