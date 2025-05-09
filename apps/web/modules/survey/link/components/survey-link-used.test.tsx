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

describe("SurveyLinkUsed", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default values when singleUseMessage is null", () => {
    render(<SurveyLinkUsed singleUseMessage={null} />);

    expect(screen.getByText("s.survey_already_answered_heading")).toBeInTheDocument();
    expect(screen.getByText("s.survey_already_answered_subheading")).toBeInTheDocument();
  });

  test("renders with custom values when singleUseMessage is provided", () => {
    const singleUseMessage: TSurveySingleUse = {
      heading: "Custom Heading",
      subheading: "Custom Subheading",
    } as any;

    render(<SurveyLinkUsed singleUseMessage={singleUseMessage} />);

    expect(screen.getByText("Custom Heading")).toBeInTheDocument();
    expect(screen.getByText("Custom Subheading")).toBeInTheDocument();
  });

  test("renders footer with link to Formbricks", () => {
    render(<SurveyLinkUsed singleUseMessage={null} />);

    const link = document.querySelector('a[href="https://formbricks.com"]');
    expect(link).toBeInTheDocument();
    expect(vi.mocked(Image)).toHaveBeenCalled();
  });
});
