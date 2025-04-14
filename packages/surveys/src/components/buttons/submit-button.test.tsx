import { cleanup, fireEvent, render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  afterEach(() => {
    cleanup();
  });

  it('renders default label "Next" when no buttonLabel is provided and isLastQuestion is false', () => {
    const { getByRole } = render(<SubmitButton buttonLabel={undefined} isLastQuestion={false} />);
    const button = getByRole("button");
    expect(button.textContent?.trim()).toBe("Next");
  });

  it('renders "Finish" when isLastQuestion is true and no buttonLabel is provided', () => {
    const { getByRole } = render(<SubmitButton buttonLabel={undefined} isLastQuestion />);
    const button = getByRole("button");
    expect(button.textContent?.trim()).toBe("Finish");
  });

  it("renders custom buttonLabel when provided", () => {
    const { getByRole } = render(<SubmitButton isLastQuestion buttonLabel="Submit Now" />);
    const button = getByRole("button");
    expect(button.textContent?.trim()).toBe("Submit Now");
  });

  it("calls onClick handler when clicked", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<SubmitButton buttonLabel="button" isLastQuestion onClick={onClick} />);
    const button = getByRole("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick or trigger click with ctrl/cmd+enter when disabled", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <SubmitButton buttonLabel="button" isLastQuestion disabled onClick={onClick} />
    );
    const button = getByRole("button");
    userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();

    userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clicks on ctrl/cmd+enter if not disabled", () => {
    const onClick = vi.fn();
    render(<SubmitButton buttonLabel="button" isLastQuestion onClick={onClick} />);
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to tabIndex=1 if none is provided", () => {
    const { getByRole } = render(<SubmitButton buttonLabel="button" isLastQuestion />);
    const button = getByRole("button");
    expect(button.tabIndex).toBe(1);
  });

  it("applies a custom tabIndex when provided", () => {
    const { getByRole } = render(<SubmitButton buttonLabel="button" isLastQuestion tabIndex={5} />);
    const button = getByRole("button");
    expect(button.tabIndex).toEqual(5);
  });

  it("focuses the button when focus=true", async () => {
    const { getByRole } = render(<SubmitButton buttonLabel="button" isLastQuestion focus />);
    const button = getByRole("button");
    // Slight delay due to setTimeout in the component
    await new Promise((r) => setTimeout(r, 300));
    expect(document.activeElement).toBe(button);
  });

  it('has dir="auto" and default type="button" attributes if not overridden', () => {
    const { getByRole } = render(<SubmitButton buttonLabel="button" isLastQuestion />);
    const button = getByRole("button") as HTMLButtonElement;
    expect(button.dir).toEqual("auto");
    expect(button.type).toEqual("submit");
  });

  it("uses the type prop when specified", () => {
    const { getByRole } = render(<SubmitButton buttonLabel="button" isLastQuestion type="submit" />);
    const button = getByRole("button") as HTMLButtonElement;
    expect(button.type).toEqual("submit");
  });

  it("contains the expected class names", () => {
    const { getByRole } = render(<SubmitButton buttonLabel="button" isLastQuestion />);
    const button = getByRole("button");
    expect(button.className).toContain("fb:bg-brand");
    expect(button.className).toContain("fb:border-submit-button-border");
    expect(button.className).toContain("fb:focus:ring-focus");
  });
});
