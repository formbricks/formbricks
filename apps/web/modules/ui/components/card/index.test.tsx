import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./index";

describe("Card Component", () => {
  test("renders basic Card component", () => {
    render(<Card data-testid="test-card">Card Content</Card>);
    const card = screen.getByTestId("test-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent("Card Content");
    expect(card).toHaveClass("rounded-xl", "border", "border-slate-200", "bg-white", "shadow-sm");
  });

  test("applies custom className to Card", () => {
    render(
      <Card data-testid="custom-card" className="custom-class">
        Card Content
      </Card>
    );
    const card = screen.getByTestId("custom-card");
    expect(card).toHaveClass("custom-class");
  });

  test("renders CardHeader component", () => {
    render(<CardHeader data-testid="test-header">Header Content</CardHeader>);
    const header = screen.getByTestId("test-header");
    expect(header).toBeInTheDocument();
    expect(header).toHaveTextContent("Header Content");
    expect(header).toHaveClass("flex", "flex-col", "space-y-1.5", "p-6");
  });

  test("applies custom className to CardHeader", () => {
    render(
      <CardHeader data-testid="custom-header" className="custom-class">
        Header Content
      </CardHeader>
    );
    const header = screen.getByTestId("custom-header");
    expect(header).toHaveClass("custom-class");
  });

  test("renders CardTitle component", () => {
    render(<CardTitle data-testid="test-title">Title Content</CardTitle>);
    const title = screen.getByTestId("test-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Title Content");
    expect(title).toHaveClass("text-2xl", "leading-none", "font-semibold", "tracking-tight");
  });

  test("renders CardTitle with sr-only when no children provided", () => {
    render(<CardTitle data-testid="empty-title" />);
    const title = screen.getByTestId("empty-title");
    expect(title).toBeInTheDocument();
    const srOnly = title.querySelector(".sr-only");
    expect(srOnly).toBeInTheDocument();
    expect(srOnly).toHaveTextContent("Title");
  });

  test("applies custom className to CardTitle", () => {
    render(
      <CardTitle data-testid="custom-title" className="custom-class">
        Title Content
      </CardTitle>
    );
    const title = screen.getByTestId("custom-title");
    expect(title).toHaveClass("custom-class");
  });

  test("renders CardDescription component", () => {
    render(<CardDescription data-testid="test-description">Description Content</CardDescription>);
    const description = screen.getByTestId("test-description");
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent("Description Content");
    expect(description).toHaveClass("text-sm", "text-muted-foreground");
  });

  test("applies custom className to CardDescription", () => {
    render(
      <CardDescription data-testid="custom-description" className="custom-class">
        Description Content
      </CardDescription>
    );
    const description = screen.getByTestId("custom-description");
    expect(description).toHaveClass("custom-class");
  });

  test("renders CardContent component", () => {
    render(<CardContent data-testid="test-content">Content</CardContent>);
    const content = screen.getByTestId("test-content");
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("Content");
    expect(content).toHaveClass("p-6", "pt-0");
  });

  test("applies custom className to CardContent", () => {
    render(
      <CardContent data-testid="custom-content" className="custom-class">
        Content
      </CardContent>
    );
    const content = screen.getByTestId("custom-content");
    expect(content).toHaveClass("custom-class");
  });

  test("renders CardFooter component", () => {
    render(<CardFooter data-testid="test-footer">Footer Content</CardFooter>);
    const footer = screen.getByTestId("test-footer");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent("Footer Content");
    expect(footer).toHaveClass("flex", "items-center", "p-6", "pt-0");
  });

  test("applies custom className to CardFooter", () => {
    render(
      <CardFooter data-testid="custom-footer" className="custom-class">
        Footer Content
      </CardFooter>
    );
    const footer = screen.getByTestId("custom-footer");
    expect(footer).toHaveClass("custom-class");
  });

  test("renders full Card with all subcomponents", () => {
    render(
      <Card data-testid="full-card">
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>Test Content</CardContent>
        <CardFooter>Test Footer</CardFooter>
      </Card>
    );

    const card = screen.getByTestId("full-card");
    expect(card).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByText("Test Footer")).toBeInTheDocument();
  });

  test("passes extra props to Card", () => {
    render(
      <Card data-testid="props-card" aria-label="Card with props" role="region">
        Test
      </Card>
    );
    const card = screen.getByTestId("props-card");
    expect(card).toHaveAttribute("aria-label", "Card with props");
    expect(card).toHaveAttribute("role", "region");
  });
});
