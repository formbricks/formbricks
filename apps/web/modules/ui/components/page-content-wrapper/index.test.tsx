import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PageContentWrapper } from "./index";

describe("PageContentWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders children correctly", () => {
    const { getByText } = render(
      <PageContentWrapper>
        <div>Test Content</div>
      </PageContentWrapper>
    );

    expect(getByText("Test Content")).toBeInTheDocument();
  });

  test("applies default classes", () => {
    const { container } = render(
      <PageContentWrapper>
        <div>Test Content</div>
      </PageContentWrapper>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("h-full");
    expect(wrapper).toHaveClass("space-y-6");
    expect(wrapper).toHaveClass("p-6");
  });

  test("applies additional className when provided", () => {
    const { container } = render(
      <PageContentWrapper className="rounded-lg bg-gray-100">
        <div>Test Content</div>
      </PageContentWrapper>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("h-full");
    expect(wrapper).toHaveClass("space-y-6");
    expect(wrapper).toHaveClass("p-6");
    expect(wrapper).toHaveClass("bg-gray-100");
    expect(wrapper).toHaveClass("rounded-lg");
  });
});
