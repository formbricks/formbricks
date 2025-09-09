import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
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

describe("Breadcrumb Components", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Breadcrumb", () => {
    test("renders as nav element with proper aria-label", () => {
      render(<Breadcrumb data-testid="breadcrumb">Test</Breadcrumb>);
      const breadcrumb = screen.getByTestId("breadcrumb");
      expect(breadcrumb).toBeInTheDocument();
      expect(breadcrumb.tagName).toBe("NAV");
      expect(breadcrumb).toHaveAttribute("aria-label", "breadcrumb");
    });

    test("forwards ref correctly", () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Breadcrumb ref={ref} data-testid="breadcrumb">
          Test
        </Breadcrumb>
      );
      expect(ref.current).toBe(screen.getByTestId("breadcrumb"));
    });

    test("passes through additional props", () => {
      render(
        <Breadcrumb data-testid="breadcrumb" className="custom-class">
          Test
        </Breadcrumb>
      );
      const breadcrumb = screen.getByTestId("breadcrumb");
      expect(breadcrumb).toHaveClass("custom-class");
    });
  });

  describe("BreadcrumbList", () => {
    test("renders as ordered list with default classes", () => {
      render(<BreadcrumbList data-testid="breadcrumb-list">Test</BreadcrumbList>);
      const list = screen.getByTestId("breadcrumb-list");
      expect(list).toBeInTheDocument();
      expect(list.tagName).toBe("OL");
      expect(list).toHaveClass("flex flex-wrap items-center gap-1.5 break-words text-sm text-slate-500");
    });

    test("applies custom className", () => {
      render(
        <BreadcrumbList data-testid="breadcrumb-list" className="custom-list-class">
          Test
        </BreadcrumbList>
      );
      const list = screen.getByTestId("breadcrumb-list");
      expect(list).toHaveClass("custom-list-class");
      expect(list).toHaveClass("flex flex-wrap items-center gap-1.5 break-words text-sm text-slate-500");
    });

    test("forwards ref correctly", () => {
      const ref = React.createRef<HTMLOListElement>();
      render(
        <BreadcrumbList ref={ref} data-testid="breadcrumb-list">
          Test
        </BreadcrumbList>
      );
      expect(ref.current).toBe(screen.getByTestId("breadcrumb-list"));
    });
  });

  describe("BreadcrumbItem", () => {
    test("renders as list item with default classes", () => {
      render(<BreadcrumbItem data-testid="breadcrumb-item">Test</BreadcrumbItem>);
      const item = screen.getByTestId("breadcrumb-item");
      expect(item).toBeInTheDocument();
      expect(item.tagName).toBe("LI");
      expect(item).toHaveClass(
        "inline-flex items-center gap-1.5 hover:outline hover:outline-slate-300 py-1 px-1.5 space-x-1 rounded-md"
      );
    });

    test("applies active styling when isActive is true", () => {
      render(
        <BreadcrumbItem data-testid="breadcrumb-item" isActive={true}>
          Test
        </BreadcrumbItem>
      );
      const item = screen.getByTestId("breadcrumb-item");
      expect(item).toHaveClass("outline outline-slate-300 bg-slate-100");
    });

    test("applies highlighted styling when isHighlighted is true", () => {
      render(
        <BreadcrumbItem data-testid="breadcrumb-item" isHighlighted={true}>
          Test
        </BreadcrumbItem>
      );
      const item = screen.getByTestId("breadcrumb-item");
      expect(item).toHaveClass("hover:outline-red-800 outline text-white bg-red-800");
    });

    test("applies both active and highlighted styling when both are true", () => {
      render(
        <BreadcrumbItem data-testid="breadcrumb-item" isActive={true} isHighlighted={true}>
          Test
        </BreadcrumbItem>
      );
      const item = screen.getByTestId("breadcrumb-item");
      // When both are true, highlighted styling takes precedence (applied last)
      expect(item).toHaveClass("outline-slate-300");
      expect(item).toHaveClass("hover:outline-red-800");
      expect(item).toHaveClass("text-white");
      expect(item).toHaveClass("bg-red-800");
      // bg-slate-100 from isActive may not be present due to CSS class precedence
    });

    test("applies custom className", () => {
      render(
        <BreadcrumbItem data-testid="breadcrumb-item" className="custom-item-class">
          Test
        </BreadcrumbItem>
      );
      const item = screen.getByTestId("breadcrumb-item");
      expect(item).toHaveClass("custom-item-class");
    });

    test("forwards ref correctly", () => {
      const ref = React.createRef<HTMLLIElement>();
      render(
        <BreadcrumbItem ref={ref} data-testid="breadcrumb-item">
          Test
        </BreadcrumbItem>
      );
      expect(ref.current).toBe(screen.getByTestId("breadcrumb-item"));
    });
  });

  describe("BreadcrumbLink", () => {
    test("renders as anchor element by default", () => {
      render(
        <BreadcrumbLink data-testid="breadcrumb-link" href="/test">
          Test Link
        </BreadcrumbLink>
      );
      const link = screen.getByTestId("breadcrumb-link");
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "/test");
      expect(link).toHaveClass("transition-colors hover:text-foreground");
    });

    test("renders as child component when asChild is true", () => {
      render(
        <BreadcrumbLink asChild data-testid="breadcrumb-link">
          <button type="button">Test Button</button>
        </BreadcrumbLink>
      );
      const button = screen.getByRole("button", { name: "Test Button" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("transition-colors hover:text-foreground");
    });

    test("applies custom className", () => {
      render(
        <BreadcrumbLink data-testid="breadcrumb-link" className="custom-link-class" href="/test">
          Test
        </BreadcrumbLink>
      );
      const link = screen.getByTestId("breadcrumb-link");
      expect(link).toHaveClass("custom-link-class");
    });

    test("forwards ref correctly", () => {
      const ref = React.createRef<HTMLAnchorElement>();
      render(
        <BreadcrumbLink ref={ref} data-testid="breadcrumb-link" href="/test">
          Test
        </BreadcrumbLink>
      );
      expect(ref.current).toBe(screen.getByTestId("breadcrumb-link"));
    });
  });

  describe("BreadcrumbPage", () => {
    test("applies custom className", () => {
      render(
        <BreadcrumbPage data-testid="breadcrumb-page" className="custom-page-class">
          Current Page
        </BreadcrumbPage>
      );
      const page = screen.getByTestId("breadcrumb-page");
      expect(page).toHaveClass("custom-page-class");
    });

    test("forwards ref correctly", () => {
      const ref = React.createRef<HTMLSpanElement>();
      render(
        <BreadcrumbPage ref={ref} data-testid="breadcrumb-page">
          Current Page
        </BreadcrumbPage>
      );
      expect(ref.current).toBe(screen.getByTestId("breadcrumb-page"));
    });
  });

  describe("BreadcrumbSeparator", () => {
    test("renders custom children instead of default icon", () => {
      render(
        <BreadcrumbSeparator data-testid="breadcrumb-separator">
          <span>|</span>
        </BreadcrumbSeparator>
      );
      const separator = screen.getByTestId("breadcrumb-separator");
      expect(separator).toContainHTML("<span>|</span>");
    });

    test("applies custom className", () => {
      render(<BreadcrumbSeparator data-testid="breadcrumb-separator" className="custom-separator-class" />);
      const separator = screen.getByTestId("breadcrumb-separator");
      expect(separator).toHaveClass("custom-separator-class");
    });
  });

  describe("BreadcrumbEllipsis", () => {
    test("applies custom className", () => {
      render(<BreadcrumbEllipsis data-testid="breadcrumb-ellipsis" className="custom-ellipsis-class" />);
      const ellipsis = screen.getByTestId("breadcrumb-ellipsis");
      expect(ellipsis).toHaveClass("custom-ellipsis-class");
    });
  });
});
