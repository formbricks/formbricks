import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PageHeader } from "./index";

describe("PageHeader", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders page title correctly", () => {
    render(<PageHeader pageTitle="Dashboard" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toHaveClass("text-3xl font-bold text-slate-800 capitalize");
  });

  test("renders with CTA", () => {
    render(<PageHeader pageTitle="Users" cta={<button data-testid="cta-button">Add User</button>} />);

    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByTestId("cta-button")).toBeInTheDocument();
    expect(screen.getByText("Add User")).toBeInTheDocument();
  });

  test("renders children correctly", () => {
    render(
      <PageHeader pageTitle="Settings">
        <div data-testid="child-element">Additional content</div>
      </PageHeader>
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByTestId("child-element")).toBeInTheDocument();
    expect(screen.getByText("Additional content")).toBeInTheDocument();
  });

  test("renders with both CTA and children", () => {
    render(
      <PageHeader pageTitle="Products" cta={<button data-testid="cta-button">New Product</button>}>
        <div data-testid="child-element">Product filters</div>
      </PageHeader>
    );

    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByTestId("cta-button")).toBeInTheDocument();
    expect(screen.getByText("New Product")).toBeInTheDocument();
    expect(screen.getByTestId("child-element")).toBeInTheDocument();
    expect(screen.getByText("Product filters")).toBeInTheDocument();
  });

  test("has border-b class", () => {
    const { container } = render(<PageHeader pageTitle="Dashboard" />);
    const headerElement = container.firstChild as HTMLElement;

    expect(headerElement).toHaveClass("border-b");
    expect(headerElement).toHaveClass("border-slate-200");
  });
});
