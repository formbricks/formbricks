import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LegalFooter } from "./legal-footer";

describe("LegalFooter", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders nothing when no links are provided and not on Formbricks cloud", () => {
    const { container } = render(<LegalFooter IS_FORMBRICKS_CLOUD={false} surveyUrl="https://example.com" />);
    expect(container.firstChild).toBeNull();
  });

  test("renders imprint link when IMPRINT_URL is provided", () => {
    render(
      <LegalFooter
        IMPRINT_URL="https://imprint.com"
        IS_FORMBRICKS_CLOUD={false}
        surveyUrl="https://example.com"
      />
    );

    const imprintLink = screen.getByText("common.imprint");
    expect(imprintLink).toBeInTheDocument();
    expect(imprintLink.tagName).toBe("A");
    expect(imprintLink).toHaveAttribute("href", "https://imprint.com");
  });

  test("renders privacy link when PRIVACY_URL is provided", () => {
    render(
      <LegalFooter
        PRIVACY_URL="https://privacy.com"
        IS_FORMBRICKS_CLOUD={false}
        surveyUrl="https://example.com"
      />
    );

    const privacyLink = screen.getByText("common.privacy");
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute("href", "https://privacy.com");
  });

  test("renders report survey link when IS_FORMBRICKS_CLOUD is true", () => {
    const surveyUrl = "https://example.com/survey";
    render(<LegalFooter IS_FORMBRICKS_CLOUD={true} surveyUrl={surveyUrl} />);

    const reportLink = screen.getByText("common.report_survey");
    expect(reportLink).toBeInTheDocument();
    expect(reportLink).toHaveAttribute(
      "href",
      `https://app.formbricks.com/s/clxbivtla014iye2vfrn436xd?surveyUrl=${surveyUrl}`
    );
  });

  test("renders all links and separators when all options are provided", () => {
    render(
      <LegalFooter
        IMPRINT_URL="https://imprint.com"
        PRIVACY_URL="https://privacy.com"
        IS_FORMBRICKS_CLOUD={true}
        surveyUrl="https://example.com/survey"
      />
    );

    const imprintLink = screen.getByText("common.imprint");
    const privacyLink = screen.getByText("common.privacy");
    const reportLink = screen.getByText("common.report_survey");

    expect(imprintLink).toBeInTheDocument();
    expect(privacyLink).toBeInTheDocument();
    expect(reportLink).toBeInTheDocument();

    const separators = screen.getAllByText("|");
    expect(separators).toHaveLength(2);
  });

  test("renders correct separator when only imprint and privacy are provided", () => {
    render(
      <LegalFooter
        IMPRINT_URL="https://imprint.com"
        PRIVACY_URL="https://privacy.com"
        IS_FORMBRICKS_CLOUD={false}
        surveyUrl="https://example.com/survey"
      />
    );

    const separators = screen.getAllByText("|");
    expect(separators).toHaveLength(1);
  });
});
