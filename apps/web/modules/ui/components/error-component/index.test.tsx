import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ErrorComponent } from "./index";

describe("ErrorComponent", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders error title", () => {
    render(<ErrorComponent />);
    expect(screen.getByTestId("error-title")).toBeInTheDocument();
  });

  test("renders error description", () => {
    render(<ErrorComponent />);
    expect(screen.getByTestId("error-description")).toBeInTheDocument();
  });

  test("renders error icon", () => {
    render(<ErrorComponent />);
    // Check if the XCircleIcon is in the document
    const iconElement = document.querySelector("[aria-hidden='true']");
    expect(iconElement).toBeInTheDocument();
  });
});
