import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TFnType } from "@tolgee/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { EmailTemplate } from "./email-template";

const mockTranslate: TFnType = (key) => key;

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  IMPRINT_URL: "https://example.com/imprint",
  PRIVACY_URL: "https://example.com/privacy",
  IMPRINT_ADDRESS: "Imprint Address",
}));

const defaultProps = {
  children: <div data-testid="child-text">Test Content</div>,
  logoUrl: "https://example.com/custom-logo.png",
  t: mockTranslate,
};

describe("EmailTemplate", () => {
  beforeEach(() => {
    cleanup();
  });

  test("renders the default logo if no custom logo is provided", async () => {
    const emailTemplateElement = await EmailTemplate({
      children: <div>Test Content</div>,
      logoUrl: undefined,
      t: mockTranslate,
    });

    render(emailTemplateElement);

    const logoImage = screen.getByTestId("default-logo-image");
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute("src", "https://example.com/mock-logo.png");
  });

  test("renders the custom logo if provided", async () => {
    const emailTemplateElement = await EmailTemplate({
      ...defaultProps,
    });

    render(emailTemplateElement);

    const logoImage = screen.getByTestId("logo-image");
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute("src", "https://example.com/custom-logo.png");
  });

  test("renders the children content", async () => {
    const emailTemplateElement = await EmailTemplate({
      ...defaultProps,
    });

    render(emailTemplateElement);

    expect(screen.getByTestId("child-text")).toBeInTheDocument();
  });

  test("renders the imprint and privacy policy links if provided", async () => {
    const emailTemplateElement = await EmailTemplate({
      ...defaultProps,
    });

    render(emailTemplateElement);

    expect(screen.getByText("emails.imprint")).toBeInTheDocument();
    expect(screen.getByText("emails.privacy_policy")).toBeInTheDocument();
  });

  test("renders the imprint address if provided", async () => {
    const emailTemplateElement = await EmailTemplate({
      ...defaultProps,
    });

    render(emailTemplateElement);

    expect(screen.getByText("emails.email_template_text_1")).toBeInTheDocument();
  });
});
