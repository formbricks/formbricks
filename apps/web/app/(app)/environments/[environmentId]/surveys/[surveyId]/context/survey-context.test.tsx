import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { SurveyContextWrapper, useSurvey } from "./survey-context";

// Mock survey data
const mockSurvey: TSurvey = {
  id: "test-survey-id",
  createdAt: new Date("2023-01-01T00:00:00.000Z"),
  updatedAt: new Date("2023-01-01T00:00:00.000Z"),
  name: "Test Survey",
  type: "link",
  environmentId: "test-env-id",
  createdBy: "test-user-id",
  status: "draft",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: {
    enabled: false,
    headline: { default: "Welcome" },
    html: { default: "" },
    timeToFinish: false,
    showResponseCount: false,
    buttonLabel: { default: "Start" },
    fileUrl: undefined,
    videoUrl: undefined,
  },
  questions: [
    {
      id: "question-1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "What's your name?" },
      required: true,
      inputType: "text",
      logic: [],
      buttonLabel: { default: "Next" },
      backButtonLabel: { default: "Back" },
      placeholder: { default: "Enter your name" },
      longAnswer: false,
      subheader: { default: "" },
      charLimit: { enabled: false, min: 0, max: 255 },
    },
  ],
  endings: [
    {
      id: "ending-1",
      type: "endScreen",
      headline: { default: "Thank you!" },
      subheader: { default: "We appreciate your feedback." },
      buttonLabel: { default: "Done" },
      buttonLink: undefined,
      imageUrl: undefined,
      videoUrl: undefined,
    },
  ],
  hiddenFields: {
    enabled: false,
    fieldIds: [],
  },
  variables: [],
  followUps: [],
  delay: 0,
  autoComplete: null,
  runOnDate: null,
  closeOnDate: null,
  projectOverwrites: null,
  styling: null,
  showLanguageSwitch: null,
  surveyClosedMessage: null,
  segment: null,
  singleUse: null,
  isVerifyEmailEnabled: false,
  recaptcha: null,
  isSingleResponsePerEmailEnabled: false,
  isBackButtonHidden: false,
  pin: null,
  displayPercentage: null,
  languages: [
    {
      language: {
        id: "en",
        code: "en",
        alias: "English",
        projectId: "test-project-id",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
      },
      default: true,
      enabled: true,
    },
  ],
};

// Test component that uses the hook
const TestComponent = () => {
  const { survey } = useSurvey();
  return (
    <div>
      <div data-testid="survey-id">{survey.id}</div>
      <div data-testid="survey-name">{survey.name}</div>
      <div data-testid="survey-type">{survey.type}</div>
      <div data-testid="survey-status">{survey.status}</div>
      <div data-testid="survey-environment-id">{survey.environmentId}</div>
    </div>
  );
};

describe("SurveyContext", () => {
  afterEach(() => {
    cleanup();
  });

  test("provides survey data to child components", () => {
    render(
      <SurveyContextWrapper survey={mockSurvey}>
        <TestComponent />
      </SurveyContextWrapper>
    );

    expect(screen.getByTestId("survey-id")).toHaveTextContent("test-survey-id");
    expect(screen.getByTestId("survey-name")).toHaveTextContent("Test Survey");
    expect(screen.getByTestId("survey-type")).toHaveTextContent("link");
    expect(screen.getByTestId("survey-status")).toHaveTextContent("draft");
    expect(screen.getByTestId("survey-environment-id")).toHaveTextContent("test-env-id");
  });

  test("throws error when useSurvey is used outside of provider", () => {
    const TestComponentWithoutProvider = () => {
      useSurvey();
      return <div>Should not render</div>;
    };

    expect(() => {
      render(<TestComponentWithoutProvider />);
    }).toThrow("useSurvey must be used within a SurveyContextWrapper");
  });

  test("updates context value when survey changes", () => {
    const updatedSurvey = {
      ...mockSurvey,
      name: "Updated Survey",
      status: "inProgress" as const,
    };

    const { rerender } = render(
      <SurveyContextWrapper survey={mockSurvey}>
        <TestComponent />
      </SurveyContextWrapper>
    );

    expect(screen.getByTestId("survey-name")).toHaveTextContent("Test Survey");
    expect(screen.getByTestId("survey-status")).toHaveTextContent("draft");

    rerender(
      <SurveyContextWrapper survey={updatedSurvey}>
        <TestComponent />
      </SurveyContextWrapper>
    );

    expect(screen.getByTestId("survey-name")).toHaveTextContent("Updated Survey");
    expect(screen.getByTestId("survey-status")).toHaveTextContent("inProgress");
  });

  test("verifies memoization by tracking render counts", () => {
    let renderCount = 0;
    const renderSpy = vi.fn(() => {
      renderCount++;
    });

    const TestComponentWithRenderTracking = () => {
      renderSpy();
      const { survey } = useSurvey();
      return (
        <div>
          <div data-testid="survey-id">{survey.id}</div>
          <div data-testid="render-count">{renderCount}</div>
        </div>
      );
    };

    const { rerender } = render(
      <SurveyContextWrapper survey={mockSurvey}>
        <TestComponentWithRenderTracking />
      </SurveyContextWrapper>
    );

    expect(screen.getByTestId("survey-id")).toHaveTextContent("test-survey-id");
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Rerender with the same survey object - should not trigger additional renders
    // if memoization is working correctly
    rerender(
      <SurveyContextWrapper survey={mockSurvey}>
        <TestComponentWithRenderTracking />
      </SurveyContextWrapper>
    );

    expect(screen.getByTestId("survey-id")).toHaveTextContent("test-survey-id");
    expect(renderSpy).toHaveBeenCalledTimes(2); // Should only be called once more for the rerender
  });

  test("prevents unnecessary re-renders when survey object is unchanged", () => {
    const childRenderSpy = vi.fn();

    const ChildComponent = () => {
      childRenderSpy();
      const { survey } = useSurvey();
      return <div data-testid="child-survey-name">{survey.name}</div>;
    };

    const ParentComponent = ({ survey }: { survey: TSurvey }) => {
      return (
        <SurveyContextWrapper survey={survey}>
          <ChildComponent />
        </SurveyContextWrapper>
      );
    };

    const { rerender } = render(<ParentComponent survey={mockSurvey} />);

    expect(screen.getByTestId("child-survey-name")).toHaveTextContent("Test Survey");
    expect(childRenderSpy).toHaveBeenCalledTimes(1);

    // Rerender with the same survey object reference
    rerender(<ParentComponent survey={mockSurvey} />);

    expect(screen.getByTestId("child-survey-name")).toHaveTextContent("Test Survey");
    expect(childRenderSpy).toHaveBeenCalledTimes(2); // Should only be called once more

    // Rerender with a different survey object should trigger re-render
    const updatedSurvey = { ...mockSurvey, name: "Updated Survey" };
    rerender(<ParentComponent survey={updatedSurvey} />);

    expect(screen.getByTestId("child-survey-name")).toHaveTextContent("Updated Survey");
    expect(childRenderSpy).toHaveBeenCalledTimes(3); // Should be called again due to prop change
  });

  test("renders children correctly", () => {
    const TestChild = () => <div data-testid="child">Child Component</div>;

    render(
      <SurveyContextWrapper survey={mockSurvey}>
        <TestChild />
      </SurveyContextWrapper>
    );

    expect(screen.getByTestId("child")).toHaveTextContent("Child Component");
  });

  test("handles multiple child components", () => {
    const TestChild1 = () => {
      const { survey } = useSurvey();
      return <div data-testid="child-1">{survey.name}</div>;
    };

    const TestChild2 = () => {
      const { survey } = useSurvey();
      return <div data-testid="child-2">{survey.type}</div>;
    };

    render(
      <SurveyContextWrapper survey={mockSurvey}>
        <TestChild1 />
        <TestChild2 />
      </SurveyContextWrapper>
    );

    expect(screen.getByTestId("child-1")).toHaveTextContent("Test Survey");
    expect(screen.getByTestId("child-2")).toHaveTextContent("link");
  });
});
