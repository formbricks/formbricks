import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "./back-button";

describe("BackButton", () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with default text "Back" and default tabIndex when no label is provided', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<BackButton onClick={onClick} />);
    const button = getByRole("button");
    expect(button).toBeDefined();
    expect(button.textContent?.trim()).toEqual("Back");
    expect(button.tabIndex).toEqual(2);
  });

  it("renders with the provided backButtonLabel", () => {
    const onClick = vi.fn();
    const label = "Go Back";
    const { getByRole } = render(<BackButton onClick={onClick} backButtonLabel={label} />);
    const button = getByRole("button");
    expect(button.textContent?.trim()).toEqual(label);
  });

  it("calls the onClick handler when clicked", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<BackButton onClick={onClick} />);
    const button = getByRole("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies a custom tabIndex when provided", () => {
    const onClick = vi.fn();
    const customTabIndex = 5;
    const { getByRole } = render(<BackButton onClick={onClick} tabIndex={customTabIndex} />);
    const button = getByRole("button");
    expect(button.tabIndex).toEqual(customTabIndex);
  });

  it('has dir="auto" and type="button" attributes', () => {
    const { getByRole } = render(<BackButton onClick={() => {}} />);
    const button = getByRole("button") as HTMLButtonElement;
    expect(button.dir).toEqual("auto");
    expect(button.type).toEqual("button");
  });

  it("contains the expected class names", () => {
    const { getByRole } = render(<BackButton onClick={() => {}} />);
    const button = getByRole("button");
    // Check a few class names to ensure styles are applied
    expect(button.className).toContain("fb-border-back-button-border");
    expect(button.className).toContain("fb-text-heading");
    expect(button.className).toContain("focus:fb-ring-focus");
  });
});
