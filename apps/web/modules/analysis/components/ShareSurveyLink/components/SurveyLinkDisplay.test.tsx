import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SurveyLinkDisplay } from "./SurveyLinkDisplay";

describe("SurveyLinkDisplay", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the Input when surveyUrl is provided", () => {
    const surveyUrl = "http://example.com/s/123";
    render(<SurveyLinkDisplay surveyUrl={surveyUrl} />);
    const input = screen.getByTestId("survey-url-input");
    expect(input).toBeInTheDocument();
  });

  it("renders loading state when surveyUrl is empty", () => {
    render(<SurveyLinkDisplay surveyUrl="" />);
    const loadingDiv = screen.getByTestId("loading-div");
    expect(loadingDiv).toBeInTheDocument();
  });
});
