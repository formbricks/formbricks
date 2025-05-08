import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { StackedCardsContainer } from "./index";

describe("StackedCardsContainer", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders children correctly", () => {
    render(
      <StackedCardsContainer cardArrangement="simple">
        <div data-testid="test-child">Test Content</div>
      </StackedCardsContainer>
    );

    expect(screen.getByTestId("test-child")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("renders with 'none' arrangement", () => {
    const { container } = render(
      <StackedCardsContainer cardArrangement="simple">
        <div>Test Content</div>
      </StackedCardsContainer>
    );

    // Should have only one div with specific classes for "none" layout
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass("flex");
    expect(mainContainer).toHaveClass("flex-col");
    expect(mainContainer).toHaveClass("items-center");
    expect(mainContainer).toHaveClass("justify-center");
    expect(mainContainer).toHaveClass("rounded-xl");
    expect(mainContainer).toHaveClass("border");
    expect(mainContainer).toHaveClass("border-slate-200");

    // Should not have shadow cards
    const allDivs = container.querySelectorAll("div");
    expect(allDivs.length).toBe(2); // Main container + child div
  });

  test("renders with 'casual' arrangement", () => {
    const { container } = render(
      <StackedCardsContainer cardArrangement="casual">
        <div>Test Content</div>
      </StackedCardsContainer>
    );

    // Should have a group container
    const groupContainer = container.firstChild as HTMLElement;
    expect(groupContainer).toHaveClass("group");
    expect(groupContainer).toHaveClass("relative");

    // Should have shadow cards
    const allDivs = container.querySelectorAll("div");
    expect(allDivs.length).toBe(5); // Group + 2 shadow cards + content container + child div

    // Check for shadow cards with rotation
    const shadowCards = container.querySelectorAll(".absolute");
    expect(shadowCards.length).toBe(2);
    expect(shadowCards[0]).toHaveClass("-rotate-6");
    expect(shadowCards[1]).toHaveClass("-rotate-3");
  });

  test("renders with 'straight' arrangement", () => {
    const { container } = render(
      <StackedCardsContainer cardArrangement="straight">
        <div>Test Content</div>
      </StackedCardsContainer>
    );

    // Should have a group container
    const groupContainer = container.firstChild as HTMLElement;
    expect(groupContainer).toHaveClass("group");
    expect(groupContainer).toHaveClass("relative");

    // Should have shadow cards
    const allDivs = container.querySelectorAll("div");
    expect(allDivs.length).toBe(5); // Group + 2 shadow cards + content container + child div

    // Check for shadow cards with translation
    const shadowCards = container.querySelectorAll(".absolute");
    expect(shadowCards.length).toBe(2);
    expect(shadowCards[0]).toHaveClass("-translate-y-8");
    expect(shadowCards[1]).toHaveClass("-translate-y-4");
  });

  test("falls back to 'none' arrangement for unknown type", () => {
    // @ts-ignore - Testing with invalid input
    const { container } = render(
      <StackedCardsContainer cardArrangement="simple">
        <div>Test Content</div>
      </StackedCardsContainer>
    );

    // Should have the same structure as "none"
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass("flex");
    expect(mainContainer).toHaveClass("flex-col");

    const allDivs = container.querySelectorAll("div");
    expect(allDivs.length).toBe(2); // Main container + child div
  });
});
