import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { HighlightedText } from "./index";

describe("HighlightedText", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders text without highlighting when search value is empty", () => {
    render(<HighlightedText value="Hello world" searchValue="" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.queryByRole("mark")).not.toBeInTheDocument();
  });

  test("renders text without highlighting when search value is just whitespace", () => {
    render(<HighlightedText value="Hello world" searchValue="   " />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.queryByRole("mark")).not.toBeInTheDocument();
  });

  test("highlights matching text when search value is provided", () => {
    const { container } = render(<HighlightedText value="Hello world" searchValue="world" />);
    const markElement = container.querySelector("mark");
    expect(markElement).toBeInTheDocument();
    expect(markElement?.textContent).toBe("world");
    expect(container.textContent).toBe("Hello world");
  });

  test("highlights all instances of matching text", () => {
    const { container } = render(<HighlightedText value="Hello world, hello everyone" searchValue="hello" />);
    const markElements = container.querySelectorAll("mark");
    expect(markElements).toHaveLength(2);
    expect(markElements[0].textContent?.toLowerCase()).toBe("hello");
    expect(markElements[1].textContent?.toLowerCase()).toBe("hello");
  });

  test("handles case insensitive matches", () => {
    const { container } = render(<HighlightedText value="Hello World" searchValue="world" />);
    const markElement = container.querySelector("mark");
    expect(markElement).toBeInTheDocument();
    expect(markElement?.textContent).toBe("World");
  });

  test("escapes special regex characters in search value", () => {
    const { container } = render(<HighlightedText value="Hello (world)" searchValue="(world)" />);
    const markElement = container.querySelector("mark");
    expect(markElement).toBeInTheDocument();
    expect(markElement?.textContent).toBe("(world)");
  });

  test("maintains the correct order of text fragments", () => {
    const { container } = render(<HighlightedText value="apple banana apple" searchValue="apple" />);
    expect(container.textContent).toBe("apple banana apple");

    const markElements = container.querySelectorAll("mark");
    expect(markElements).toHaveLength(2);
    expect(markElements[0].textContent).toBe("apple");
    expect(markElements[1].textContent).toBe("apple");
  });
});
