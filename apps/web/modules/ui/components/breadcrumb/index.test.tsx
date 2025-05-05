import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./index";

describe("Breadcrumb", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders Breadcrumb component", () => {
    render(<Breadcrumb data-testid="breadcrumb">Breadcrumb Content</Breadcrumb>);
    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb").tagName).toBe("NAV");
    expect(screen.getByTestId("breadcrumb")).toHaveAttribute("aria-label", "breadcrumb");
  });

  test("renders BreadcrumbList component", () => {
    render(<BreadcrumbList data-testid="breadcrumb-list">List Content</BreadcrumbList>);
    expect(screen.getByTestId("breadcrumb-list")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb-list").tagName).toBe("OL");
    expect(screen.getByTestId("breadcrumb-list")).toHaveClass("flex", "flex-wrap", "items-center", "gap-1.5");
  });

  test("renders BreadcrumbItem component", () => {
    render(<BreadcrumbItem data-testid="breadcrumb-item">Item Content</BreadcrumbItem>);
    expect(screen.getByTestId("breadcrumb-item")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb-item").tagName).toBe("LI");
    expect(screen.getByTestId("breadcrumb-item")).toHaveClass("inline-flex", "items-center", "gap-1.5");
  });

  test("renders BreadcrumbLink component", () => {
    render(
      <BreadcrumbLink data-testid="breadcrumb-link" href="/test">
        Link Content
      </BreadcrumbLink>
    );
    expect(screen.getByTestId("breadcrumb-link")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb-link").tagName).toBe("A");
    expect(screen.getByTestId("breadcrumb-link")).toHaveAttribute("href", "/test");
    expect(screen.getByTestId("breadcrumb-link")).toHaveClass("transition-colors");
  });

  test("renders BreadcrumbPage component", () => {
    render(<BreadcrumbPage data-testid="breadcrumb-page">Page Content</BreadcrumbPage>);
    expect(screen.getByTestId("breadcrumb-page")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb-page").tagName).toBe("SPAN");
    expect(screen.getByTestId("breadcrumb-page")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("breadcrumb-page")).toHaveAttribute("role", "link");
    expect(screen.getByTestId("breadcrumb-page")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("breadcrumb-page")).toHaveClass("font-normal", "text-slate-950");
  });

  test("renders BreadcrumbSeparator component with default children", () => {
    render(<BreadcrumbSeparator data-testid="breadcrumb-separator" />);
    expect(screen.getByTestId("breadcrumb-separator")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb-separator").tagName).toBe("LI");
    expect(screen.getByTestId("breadcrumb-separator")).toHaveAttribute("role", "presentation");
    expect(screen.getByTestId("breadcrumb-separator")).toHaveAttribute("aria-hidden", "true");

    // Default separator should contain an SVG
    const svg = screen.getByTestId("breadcrumb-separator").querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  test("renders BreadcrumbSeparator component with custom children", () => {
    render(
      <BreadcrumbSeparator data-testid="breadcrumb-separator">
        <span data-testid="custom-separator">/</span>
      </BreadcrumbSeparator>
    );
    expect(screen.getByTestId("breadcrumb-separator")).toBeInTheDocument();
    expect(screen.getByTestId("custom-separator")).toBeInTheDocument();
    expect(screen.getByTestId("custom-separator").textContent).toBe("/");
  });

  test("renders BreadcrumbEllipsis component", () => {
    render(<BreadcrumbEllipsis data-testid="breadcrumb-ellipsis" />);
    expect(screen.getByTestId("breadcrumb-ellipsis")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumb-ellipsis").tagName).toBe("SPAN");
    expect(screen.getByTestId("breadcrumb-ellipsis")).toHaveAttribute("role", "presentation");
    expect(screen.getByTestId("breadcrumb-ellipsis")).toHaveAttribute("aria-hidden", "true");

    // Should contain an SVG
    const svg = screen.getByTestId("breadcrumb-ellipsis").querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Should have a screen reader text
    const srOnly = screen.getByText("More");
    expect(srOnly).toBeInTheDocument();
    expect(srOnly).toHaveClass("sr-only");
  });

  test("renders a complete breadcrumb navigation", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/products">Products</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current Page</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Current Page")).toBeInTheDocument();

    const separators = document.querySelectorAll("[role='presentation']");
    expect(separators.length).toBe(2);
  });

  test("applies custom classNames to components", () => {
    render(
      <>
        <Breadcrumb data-testid="custom-breadcrumb" className="test-class-1" />
        <BreadcrumbList data-testid="custom-list" className="test-class-2" />
        <BreadcrumbItem data-testid="custom-item" className="test-class-3" />
        <BreadcrumbLink data-testid="custom-link" className="test-class-4" />
        <BreadcrumbPage data-testid="custom-page" className="test-class-5" />
        <BreadcrumbSeparator data-testid="custom-separator" className="test-class-6" />
        <BreadcrumbEllipsis data-testid="custom-ellipsis" className="test-class-7" />
      </>
    );

    expect(screen.getByTestId("custom-breadcrumb")).toHaveClass("test-class-1");
    expect(screen.getByTestId("custom-list")).toHaveClass("test-class-2");
    expect(screen.getByTestId("custom-item")).toHaveClass("test-class-3");
    expect(screen.getByTestId("custom-link")).toHaveClass("test-class-4");
    expect(screen.getByTestId("custom-page")).toHaveClass("test-class-5");
    expect(screen.getByTestId("custom-separator")).toHaveClass("test-class-6");
    expect(screen.getByTestId("custom-ellipsis")).toHaveClass("test-class-7");
  });
});
