import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import NotFound from "./not-found";

describe("NotFound", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders 404 page with correct content", () => {
    render(<NotFound />);

    // Check for the 404 text
    const errorCode = screen.getByTestId("error-code");
    expect(errorCode).toBeInTheDocument();
    expect(errorCode).toHaveClass("text-sm", "font-semibold");
    expect(errorCode).toHaveTextContent("404");

    // Check for the heading
    const heading = screen.getByRole("heading", { name: "Page not found" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("mt-2", "text-2xl", "font-bold");

    // Check for the error message
    const errorMessage = screen.getByTestId("error-message");
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveClass("mt-2", "text-base");
    expect(errorMessage).toHaveTextContent("Sorry, we couldn't find the page you're looking for.");

    // Check for the button
    const button = screen.getByRole("button", { name: "Back to home" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("mt-8");
  });
});
