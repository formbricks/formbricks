import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Title } from "./index";

describe("Title Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders children correctly", () => {
    render(<Title>Test Title</Title>);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  test("renders as h3 element by default", () => {
    render(<Title>Test Title</Title>);
    const titleElement = screen.getByRole("heading", { level: 3 });
    expect(titleElement).toBeInTheDocument();
  });

  test("applies default classes", () => {
    render(<Title>Test Title</Title>);
    const titleElement = screen.getByText("Test Title");
    expect(titleElement).toHaveClass("font-medium", "leading-6", "text-slate-900", "text-lg");
  });

  test("applies capitalize class when capitalize prop is true", () => {
    render(<Title capitalize={true}>test title</Title>);
    const titleElement = screen.getByText("test title");
    expect(titleElement).toHaveClass("capitalize");
  });

  test("applies default size class when size is not specified", () => {
    render(<Title>Test Title</Title>);
    const titleElement = screen.getByText("Test Title");
    expect(titleElement).toHaveClass("text-lg");
  });

  test("applies correct size class when size prop is 'md'", () => {
    render(<Title size="md">Test Title</Title>);
    const titleElement = screen.getByText("Test Title");
    expect(titleElement).toHaveClass("text-base");
  });

  test("applies both capitalize and size classes when both props are provided", () => {
    render(
      <Title capitalize={true} size="md">
        test title
      </Title>
    );
    const titleElement = screen.getByText("test title");
    expect(titleElement).toHaveClass("capitalize", "text-base");
  });
});
