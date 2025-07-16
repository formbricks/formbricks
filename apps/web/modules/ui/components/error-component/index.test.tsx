import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ErrorComponent } from "./index";

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.error_component_title": "Something went wrong",
        "common.error_component_description": "An unexpected error occurred. Please try again.",
      };
      return translations[key] || key;
    },
  }),
}));

describe("ErrorComponent", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default translations when no props provided", () => {
    render(<ErrorComponent />);

    expect(screen.getByTestId("error-title")).toHaveTextContent("Something went wrong");
    expect(screen.getByTestId("error-description")).toHaveTextContent(
      "An unexpected error occurred. Please try again."
    );
  });

  test("renders with custom title when provided", () => {
    const customTitle = "Custom Error Title";
    render(<ErrorComponent title={customTitle} />);

    expect(screen.getByTestId("error-title")).toHaveTextContent(customTitle);
    expect(screen.getByTestId("error-description")).toHaveTextContent(
      "An unexpected error occurred. Please try again."
    );
  });

  test("renders with custom description when provided", () => {
    const customDescription = "Custom error description";
    render(<ErrorComponent description={customDescription} />);

    expect(screen.getByTestId("error-title")).toHaveTextContent("Something went wrong");
    expect(screen.getByTestId("error-description")).toHaveTextContent(customDescription);
  });

  test("renders with both custom title and description when provided", () => {
    const customTitle = "Custom Error Title";
    const customDescription = "Custom error description";
    render(<ErrorComponent title={customTitle} description={customDescription} />);

    expect(screen.getByTestId("error-title")).toHaveTextContent(customTitle);
    expect(screen.getByTestId("error-description")).toHaveTextContent(customDescription);
  });

  test("renders error icon", () => {
    render(<ErrorComponent />);
    // Check if the XCircleIcon is in the document
    const iconElement = document.querySelector("[aria-hidden='true']");
    expect(iconElement).toBeInTheDocument();
  });

  test("uses fallback translation when title is empty string", () => {
    render(<ErrorComponent title="" />);
    expect(screen.getByTestId("error-title")).toHaveTextContent("Something went wrong");
  });

  test("uses fallback translation when description is empty string", () => {
    render(<ErrorComponent description="" />);
    expect(screen.getByTestId("error-description")).toHaveTextContent(
      "An unexpected error occurred. Please try again."
    );
  });
});
