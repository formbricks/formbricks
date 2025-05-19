import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { RecaptchaBranding } from "./recaptcha-branding";

describe("RecaptchaBranding", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with correct text content", () => {
    const { container } = render(<RecaptchaBranding />);
    const paragraph = container.querySelector("p");
    expect(paragraph).toHaveTextContent("Protected by reCAPTCHA and the Google");
    expect(paragraph).toHaveTextContent("Privacy Policy");
    expect(paragraph).toHaveTextContent("Terms of Service");
    expect(paragraph).toHaveTextContent("apply.");
  });

  test("renders links with correct attributes", () => {
    render(<RecaptchaBranding />);

    const privacyLink = screen.getByText("Privacy Policy").closest("a");
    expect(privacyLink).toHaveAttribute("href", "https://policies.google.com/privacy");
    expect(privacyLink).toHaveAttribute("target", "_blank");
    expect(privacyLink).toHaveAttribute("rel", "noopener");

    const termsLink = screen.getByText("Terms of Service").closest("a");
    expect(termsLink).toHaveAttribute("href", "https://policies.google.com/terms");
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", "noopener");
  });

  test("has correct styling classes", () => {
    const { container } = render(<RecaptchaBranding />);
    const paragraph = container.firstChild as HTMLElement;
    expect(paragraph).toHaveClass("fb-text-signature", "fb-text-xs", "fb-text-center");
  });

  test("links are wrapped in bold tags", () => {
    render(<RecaptchaBranding />);

    const privacyLink = screen.getByText("Privacy Policy");
    expect(privacyLink.parentElement?.tagName).toBe("B");

    const termsLink = screen.getByText("Terms of Service");
    expect(termsLink.parentElement?.tagName).toBe("B");
  });
});
