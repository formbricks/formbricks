import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

// Mock the PricingPage component
vi.mock("@/modules/ee/billing/page", () => ({
  PricingPage: () => <div data-testid="mocked-pricing-page">PricingPage Content</div>,
}));

describe("Billing Page", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the PricingPage component", () => {
    render(<Page />);
    const pricingPageComponent = screen.getByTestId("mocked-pricing-page");
    expect(pricingPageComponent).toBeInTheDocument();
    expect(pricingPageComponent).toHaveTextContent("PricingPage Content");
  });
});
