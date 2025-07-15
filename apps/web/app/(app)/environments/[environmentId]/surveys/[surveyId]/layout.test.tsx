// Import the mocked function to access it in tests
import { getSurvey } from "@/lib/survey/service";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import SurveyLayout from "./layout";

// Mock the getSurvey function
vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

// Mock the SurveyContextWrapper component
vi.mock("./context/survey-context", () => ({
  SurveyContextWrapper: ({ survey, children }: { survey: TSurvey; children: React.ReactNode }) => (
    <div data-testid="survey-context-wrapper" data-survey-id={survey.id}>
      {children}
    </div>
  ),
}));

describe("SurveyLayout", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockSurvey: TSurvey = {
    id: "survey-123",
    name: "Test Survey",
    environmentId: "env-123",
    status: "inProgress",
    type: "link",
    createdAt: new Date(),
    updatedAt: new Date(),
    questions: [],
    endings: [],
    hiddenFields: {
      enabled: false,
    },
    variables: [],
    welcomeCard: {
      enabled: false,
      timeToFinish: true,
      showResponseCount: false,
    },
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    autoClose: null,
    runOnDate: null,
    closeOnDate: null,
    delay: 0,
    displayPercentage: null,
    autoComplete: null,
    isVerifyEmailEnabled: false,
    isSingleResponsePerEmailEnabled: false,
    isBackButtonHidden: false,
    projectOverwrites: {
      brandColor: null,
      highlightBorderColor: null,
      placement: null,
      clickOutsideClose: null,
      darkOverlay: null,
    },
    styling: null,
    surveyClosedMessage: null,
    singleUse: null,
    pin: null,
    resultShareKey: null,
    showLanguageSwitch: false,
    recaptcha: null,
    languages: [],
    triggers: [],
    segment: null,
    followUps: [],
    createdBy: null,
  };

  const mockParams = Promise.resolve({
    surveyId: "survey-123",
    environmentId: "env-123",
  });

  test("renders SurveyContextWrapper with survey and children when survey is found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

    render(
      await SurveyLayout({
        params: mockParams,
        children: <div data-testid="test-children">Test Content</div>,
      })
    );

    expect(getSurvey).toHaveBeenCalledWith("survey-123");
    expect(screen.getByTestId("survey-context-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("survey-context-wrapper")).toHaveAttribute("data-survey-id", "survey-123");
    expect(screen.getByTestId("test-children")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("throws error when survey is not found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);

    await expect(
      SurveyLayout({
        params: mockParams,
        children: <div data-testid="test-children">Test Content</div>,
      })
    ).rejects.toThrow("Survey not found");

    expect(getSurvey).toHaveBeenCalledWith("survey-123");
  });

  test("awaits params before calling getSurvey", async () => {
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

    const delayedParams = new Promise<{ surveyId: string; environmentId: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          surveyId: "survey-456",
          environmentId: "env-456",
        });
      }, 10);
    });

    render(
      await SurveyLayout({
        params: delayedParams,
        children: <div data-testid="test-children">Test Content</div>,
      })
    );

    expect(getSurvey).toHaveBeenCalledWith("survey-456");
    expect(screen.getByTestId("survey-context-wrapper")).toHaveAttribute("data-survey-id", "survey-123");
  });

  test("calls getSurvey with correct surveyId from params", async () => {
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

    const customParams = Promise.resolve({
      surveyId: "custom-survey-id",
      environmentId: "custom-env-id",
    });

    render(
      await SurveyLayout({
        params: customParams,
        children: <div data-testid="test-children">Test Content</div>,
      })
    );

    expect(getSurvey).toHaveBeenCalledWith("custom-survey-id");
    expect(getSurvey).toHaveBeenCalledTimes(1);
  });

  test("passes children to SurveyContextWrapper", async () => {
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

    const complexChildren = (
      <div data-testid="complex-children">
        <h1>Survey Title</h1>
        <p>Survey description</p>
        <button>Submit</button>
      </div>
    );

    render(
      await SurveyLayout({
        params: mockParams,
        children: complexChildren,
      })
    );

    expect(screen.getByTestId("complex-children")).toBeInTheDocument();
    expect(screen.getByText("Survey Title")).toBeInTheDocument();
    expect(screen.getByText("Survey description")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  test("handles getSurvey rejection correctly", async () => {
    const mockError = new Error("Database connection failed");
    vi.mocked(getSurvey).mockRejectedValue(mockError);

    await expect(
      SurveyLayout({
        params: mockParams,
        children: <div data-testid="test-children">Test Content</div>,
      })
    ).rejects.toThrow("Database connection failed");

    expect(getSurvey).toHaveBeenCalledWith("survey-123");
  });
});
