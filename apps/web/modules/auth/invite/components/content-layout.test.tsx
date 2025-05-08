import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ContentLayout } from "./content-layout";

describe("ContentLayout", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders headline and description", () => {
    render(<ContentLayout headline="Test Headline" description="Test Description" />);

    expect(screen.getByText("Test Headline")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  test("renders children when provided", () => {
    render(
      <ContentLayout headline="Test Headline" description="Test Description">
        <div>Test Child</div>
      </ContentLayout>
    );

    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });
});
