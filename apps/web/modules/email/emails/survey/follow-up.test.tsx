import { getTranslate } from "@/tolgee/server";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { DefaultParamType, TFnType, TranslationKey } from "@tolgee/react/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpEmail } from "./follow-up";

vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  IMPRINT_URL: "https://example.com/imprint",
  PRIVACY_URL: "https://example.com/privacy",
  IMPRINT_ADDRESS: "Imprint Address",
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

const defaultProps = {
  html: "<p>Test HTML Content</p>",
  logoUrl: "https://example.com/custom-logo.png",
};

describe("FollowUpEmail", () => {
  beforeEach(() => {
    vi.mocked(getTranslate).mockResolvedValue(
      ((key: string) => key) as TFnType<DefaultParamType, string, TranslationKey>
    );
  });

  it("renders the default logo if no custom logo is provided", async () => {
    const followUpEmailElement = await FollowUpEmail({
      ...defaultProps,
      logoUrl: undefined,
    });

    render(followUpEmailElement);

    const logoImage = screen.getByAltText("Logo");
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute("src", "https://example.com/mock-logo.png");
  });

  it("renders the custom logo if provided", async () => {
    const followUpEmailElement = await FollowUpEmail({
      ...defaultProps,
    });

    render(followUpEmailElement);

    const logoImage = screen.getByAltText("Logo");
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute("src", "https://example.com/custom-logo.png");
  });

  it("renders the HTML content", async () => {
    const followUpEmailElement = await FollowUpEmail({
      ...defaultProps,
    });

    render(followUpEmailElement);

    expect(screen.getByText("Test HTML Content")).toBeInTheDocument();
  });

  it("renders the imprint and privacy policy links if provided", async () => {
    const followUpEmailElement = await FollowUpEmail({
      ...defaultProps,
    });

    render(followUpEmailElement);

    expect(screen.getByText("emails.imprint")).toBeInTheDocument();
    expect(screen.getByText("emails.privacy_policy")).toBeInTheDocument();
  });

  it("renders the imprint address if provided", async () => {
    const followUpEmailElement = await FollowUpEmail({
      ...defaultProps,
    });

    render(followUpEmailElement);

    expect(screen.getByText("emails.powered_by_formbricks")).toBeInTheDocument();
    expect(screen.getByText("Imprint Address")).toBeInTheDocument();
  });
});
