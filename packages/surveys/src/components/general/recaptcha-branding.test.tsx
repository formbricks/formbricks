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
    expect(paragraph).toHaveTextContent("common.protected_by_reCAPTCHA_and_the_Google");
    expect(paragraph).toHaveTextContent("common.privacy_policy");
    expect(paragraph).toHaveTextContent("common.terms_of_service");
    expect(paragraph).toHaveTextContent("common.apply");
  });

  test("renders links with correct attributes", () => {
    render(<RecaptchaBranding />);

    const privacyLink = screen.getByText("common.privacy_policy").closest("a");
    expect(privacyLink).toHaveAttribute("href", "https://policies.google.com/privacy");
    expect(privacyLink).toHaveAttribute("target", "_blank");
    expect(privacyLink).toHaveAttribute("rel", "noopener");

    const termsLink = screen.getByText("common.terms_of_service").closest("a");
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

    const privacyLink = screen.getByText("common.privacy_policy");
    expect(privacyLink.parentElement?.tagName).toBe("B");

    const termsLink = screen.getByText("common.terms_of_service");
    expect(termsLink.parentElement?.tagName).toBe("B");
  });
});
