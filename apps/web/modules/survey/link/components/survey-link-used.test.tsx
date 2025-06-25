import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Image from "next/image";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveySingleUse } from "@formbricks/types/surveys/types";
import { SurveyLinkUsed } from "./survey-link-used";

vi.mock("next/image", () => ({
  default: vi.fn(() => null),
}));

vi.mock("next/link", () => ({
  default: vi.fn(({ children, href }) => <a href={href}>{children}</a>),
}));

const mockProject = {
  linkSurveyBranding: true,
};

describe("SurveyLinkUsed", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default values when singleUseMessage is null", () => {
    render(<SurveyLinkUsed singleUseMessage={null} project={mockProject} />);

    expect(screen.getByText("s.survey_already_answered_heading")).toBeInTheDocument();
    expect(screen.getByText("s.survey_already_answered_subheading")).toBeInTheDocument();
  });

  test("renders with custom values when singleUseMessage is provided", () => {
    const singleUseMessage: TSurveySingleUse = {
      heading: "Custom Heading",
      subheading: "Custom Subheading",
    } as any;

    render(<SurveyLinkUsed singleUseMessage={singleUseMessage} project={mockProject} />);

    expect(screen.getByText("Custom Heading")).toBeInTheDocument();
    expect(screen.getByText("Custom Subheading")).toBeInTheDocument();
  });

  test("renders footer with link to Formbricks when branding is enabled", () => {
    render(<SurveyLinkUsed singleUseMessage={null} project={mockProject} />);

    const link = document.querySelector('a[href="https://formbricks.com"]');
    expect(link).toBeInTheDocument();
    expect(vi.mocked(Image)).toHaveBeenCalled();
  });

  test("does not render footer when branding is disabled", () => {
    const projectWithoutBranding = {
      linkSurveyBranding: false,
    };

    render(<SurveyLinkUsed singleUseMessage={null} project={projectWithoutBranding} />);

    const link = document.querySelector('a[href="https://formbricks.com"]');
    expect(link).not.toBeInTheDocument();
  });
});
