import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { SurveyLinkDisplay } from "./SurveyLinkDisplay";

describe("SurveyLinkDisplay", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the Input when surveyUrl is provided", () => {
    const surveyUrl = "http://example.com/s/123";
    render(<SurveyLinkDisplay surveyUrl={surveyUrl} />);
    const input = screen.getByTestId("survey-url-input");
    expect(input).toBeInTheDocument();
  });

  test("renders loading state when surveyUrl is empty", () => {
    render(<SurveyLinkDisplay surveyUrl="" />);
    const loadingDiv = screen.getByTestId("loading-div");
    expect(loadingDiv).toBeInTheDocument();
  });
});
