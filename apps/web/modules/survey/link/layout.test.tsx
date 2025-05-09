import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LinkSurveyLayout, viewport } from "./layout";

describe("LinkSurveyLayout", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders children correctly", () => {
    render(<LinkSurveyLayout>Test Content</LinkSurveyLayout>);
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("has the correct class", () => {
    const { container } = render(<LinkSurveyLayout>Test</LinkSurveyLayout>);
    expect(container.firstChild).toHaveClass("h-dvh");
  });

  test("viewport has correct properties", () => {
    expect(viewport).toEqual({
      width: "device-width",
      initialScale: 1.0,
      maximumScale: 1.0,
      userScalable: false,
      viewportFit: "contain",
    });
  });
});
