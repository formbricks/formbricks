import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { Headline } from "./headline";

describe("Headline", () => {
  const defaultProps = {
    headline: "Test Question",
    questionId: "test-id" as const,
  };

  afterEach(() => {
    cleanup();
  });

  test("renders headline text correctly", () => {
    const { container } = render(<Headline {...defaultProps} />);
    const label = container.querySelector("label");

    expect(label).toHaveTextContent("Test Question");
    expect(label).toHaveAttribute("for", "test-id");
    expect(label).toHaveClass("fb-text-heading", "fb-mb-[3px]", "fb-flex", "fb-flex-col");
  });

  test("renders with left alignment by default", () => {
    const { container } = render(<Headline {...defaultProps} />);
    const div = container.querySelector("div");

    expect(div).toHaveClass("fb-flex", "fb-items-center", "fb-justify-between");
    expect(div).not.toHaveClass("fb-justify-center");
  });

  test("renders with center alignment when alignTextCenter is true", () => {
    const { container } = render(<Headline {...defaultProps} alignTextCenter={true} />);
    const div = container.querySelector("div");

    expect(div).toHaveClass("fb-flex", "fb-items-center", "fb-justify-center");
    expect(div).not.toHaveClass("fb-justify-between");
  });

  test("does not show 'Optional' text when required is true", () => {
    const { queryByTestId } = render(<Headline {...defaultProps} required={true} />);
    const optionalText = queryByTestId("fb__surveys__headline-optional-text-test");

    expect(optionalText).not.toBeInTheDocument();
  });

  test("shows 'Optional' text when required is false", () => {
    const { container } = render(<Headline {...defaultProps} required={false} />);
    const optionalText = container.querySelector("span");

    expect(optionalText).toBeInTheDocument();
    expect(optionalText).toHaveTextContent("Optional");
    expect(optionalText).toHaveClass("fb-text-xs", "fb-opacity-60", "fb-font-normal");
    expect(optionalText).toHaveAttribute("tabIndex", "-1");
  });

  test("sets dir attribute to auto", () => {
    const { container } = render(<Headline {...defaultProps} />);
    const div = container.querySelector("div");

    expect(div).toHaveAttribute("dir", "auto");
  });
});
