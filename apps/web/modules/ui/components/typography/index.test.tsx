import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { H1, H2, H3, H4, InlineCode, Large, Lead, List, Muted, P, Quote, Small } from "./index";

describe("Typography Components", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders H1 correctly", () => {
    const { container } = render(<H1>Heading 1</H1>);
    const h1Element = container.querySelector("h1");

    expect(h1Element).toBeInTheDocument();
    expect(h1Element).toHaveTextContent("Heading 1");
    expect(h1Element?.className).toContain("text-4xl");
    expect(h1Element?.className).toContain("font-bold");
    expect(h1Element?.className).toContain("tracking-tight");
    expect(h1Element?.className).toContain("text-slate-800");
  });

  test("renders H2 correctly", () => {
    const { container } = render(<H2>Heading 2</H2>);
    const h2Element = container.querySelector("h2");

    expect(h2Element).toBeInTheDocument();
    expect(h2Element).toHaveTextContent("Heading 2");
    expect(h2Element?.className).toContain("text-3xl");
    expect(h2Element?.className).toContain("font-semibold");
    expect(h2Element?.className).toContain("border-b");
    expect(h2Element?.className).toContain("text-slate-800");
  });

  test("renders H3 correctly", () => {
    const { container } = render(<H3>Heading 3</H3>);
    const h3Element = container.querySelector("h3");

    expect(h3Element).toBeInTheDocument();
    expect(h3Element).toHaveTextContent("Heading 3");
    expect(h3Element?.className).toContain("text-2xl");
    expect(h3Element?.className).toContain("font-semibold");
    expect(h3Element?.className).toContain("text-slate-800");
  });

  test("renders H4 correctly", () => {
    const { container } = render(<H4>Heading 4</H4>);
    const h4Element = container.querySelector("h4");

    expect(h4Element).toBeInTheDocument();
    expect(h4Element).toHaveTextContent("Heading 4");
    expect(h4Element?.className).toContain("text-xl");
    expect(h4Element?.className).toContain("font-semibold");
    expect(h4Element?.className).toContain("text-slate-800");
  });

  test("renders Lead correctly", () => {
    const { container } = render(<Lead>Lead paragraph</Lead>);
    const pElement = container.querySelector("p");

    expect(pElement).toBeInTheDocument();
    expect(pElement).toHaveTextContent("Lead paragraph");
    expect(pElement?.className).toContain("text-xl");
    expect(pElement?.className).toContain("text-slate-800");
  });

  test("renders P correctly", () => {
    const { container } = render(<P>Standard paragraph</P>);
    const pElement = container.querySelector("p");

    expect(pElement).toBeInTheDocument();
    expect(pElement).toHaveTextContent("Standard paragraph");
    expect(pElement?.className).toContain("leading-7");
  });

  test("renders Large correctly", () => {
    const { container } = render(<Large>Large text</Large>);
    const divElement = container.querySelector("div");

    expect(divElement).toBeInTheDocument();
    expect(divElement).toHaveTextContent("Large text");
    expect(divElement?.className).toContain("text-lg");
    expect(divElement?.className).toContain("font-semibold");
  });

  test("renders Small correctly", () => {
    const { container } = render(<Small>Small text</Small>);
    const pElement = container.querySelector("p");

    expect(pElement).toBeInTheDocument();
    expect(pElement).toHaveTextContent("Small text");
    expect(pElement?.className).toContain("text-sm");
    expect(pElement?.className).toContain("font-medium");
  });

  test("renders Muted correctly", () => {
    const { container } = render(<Muted>Muted text</Muted>);
    const spanElement = container.querySelector("span");

    expect(spanElement).toBeInTheDocument();
    expect(spanElement).toHaveTextContent("Muted text");
    expect(spanElement?.className).toContain("text-sm");
    expect(spanElement?.className).toContain("text-muted-foreground");
  });

  test("renders InlineCode correctly", () => {
    const { container } = render(<InlineCode>code</InlineCode>);
    const codeElement = container.querySelector("code");

    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveTextContent("code");
    expect(codeElement?.className).toContain("font-mono");
    expect(codeElement?.className).toContain("text-sm");
    expect(codeElement?.className).toContain("font-semibold");
  });

  test("renders List correctly", () => {
    const { container } = render(
      <List>
        <li>Item 1</li>
        <li>Item 2</li>
      </List>
    );
    const ulElement = container.querySelector("ul");
    const liElements = container.querySelectorAll("li");

    expect(ulElement).toBeInTheDocument();
    expect(liElements.length).toBe(2);
    expect(ulElement?.className).toContain("list-disc");
    expect(liElements[0]).toHaveTextContent("Item 1");
    expect(liElements[1]).toHaveTextContent("Item 2");
  });

  test("renders Quote correctly", () => {
    const { container } = render(<Quote>Quoted text</Quote>);
    const blockquoteElement = container.querySelector("blockquote");

    expect(blockquoteElement).toBeInTheDocument();
    expect(blockquoteElement).toHaveTextContent("Quoted text");
    expect(blockquoteElement?.className).toContain("border-l-2");
    expect(blockquoteElement?.className).toContain("italic");
  });

  test("applies custom className to components", () => {
    const { container } = render(<H1 className="custom-class">Custom Heading</H1>);
    const h1Element = container.querySelector("h1");

    expect(h1Element).toHaveClass("custom-class");
    expect(h1Element).toHaveClass("text-4xl"); // Should still have default classes
  });

  test("passes additional props to components", () => {
    const { container } = render(<H1 data-testid="test-heading">Test Heading</H1>);
    const h1Element = container.querySelector("h1");

    expect(h1Element).toHaveAttribute("data-testid", "test-heading");
  });
});
