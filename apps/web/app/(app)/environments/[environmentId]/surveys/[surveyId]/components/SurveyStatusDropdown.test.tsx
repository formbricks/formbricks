import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { SurveyStatusDropdown } from "./SurveyStatusDropdown";

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((error) => error?.message || "An error occurred"),
}));

vi.mock("@/modules/ui/components/select", () => ({
  Select: vi.fn(({ value, onValueChange, disabled, children }) => (
    <div data-testid="select-container" data-disabled={disabled}>
      <div data-testid="select-value">{value}</div>
      {children}
      <button data-testid="select-trigger" onClick={() => onValueChange("paused")}>
        Trigger Change
      </button>
    </div>
  )),
  SelectContent: vi.fn(({ children }) => <div data-testid="select-content">{children}</div>),
  SelectItem: vi.fn(({ value, children }) => <div data-testid={`select-item-${value}`}>{children}</div>),
  SelectTrigger: vi.fn(({ children }) => <div data-testid="actual-select-trigger">{children}</div>),
  SelectValue: vi.fn(({ children }) => <div>{children}</div>),
}));

vi.mock("@/modules/ui/components/survey-status-indicator", () => ({
  SurveyStatusIndicator: vi.fn(({ status }) => (
    <div data-testid="survey-status-indicator">{`Status: ${status}`}</div>
  )),
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: vi.fn(({ children }) => <div data-testid="tooltip">{children}</div>),
  TooltipContent: vi.fn(({ children }) => <div data-testid="tooltip-content">{children}</div>),
  TooltipProvider: vi.fn(({ children }) => <div>{children}</div>),
  TooltipTrigger: vi.fn(({ children }) => <div data-testid="tooltip-trigger">{children}</div>),
}));

vi.mock("../actions", () => ({
  updateSurveyAction: vi.fn(),
}));

const mockEnvironment: TEnvironment = {
  id: "env_1",
  createdAt: new Date(),
  updatedAt: new Date(),
  projectId: "proj_1",
  type: "production",
  appSetupCompleted: true,
  productOverwrites: null,
  brandLinks: null,
  recontactDays: 30,
  displayBranding: true,
  highlightBorderColor: null,
  placement: "bottomRight",
  clickOutsideClose: true,
  darkOverlay: false,
};

const baseSurvey: TSurvey = {
  id: "survey_1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "app",
  environmentId: "env_1",
  status: "draft",
  questions: [],
  hiddenFields: { enabled: true, fieldIds: [] },
  displayOption: "displayOnce",
  recontactDays: null,
  autoClose: null,
  delay: 0,
  displayPercentage: null,
  redirectUrl: null,
  welcomeCard: { enabled: true } as TSurvey["welcomeCard"],
  languages: [],
  styling: null,
  variables: [],
  triggers: [],
  numDisplays: 0,
  responseRate: 0,
  responses: [],
  summary: { completedResponses: 0, displays: 0, totalResponses: 0, startsPercentage: 0 },
  isResponseEncryptionEnabled: false,
  isSingleUse: false,
  segment: null,
  surveyClosedMessage: null,
  resultShareKey: null,
  singleUse: null,
  verifyEmail: null,
  pin: null,
  closeOnDate: null,
  productOverwrites: null,
  analytics: {
    numCTA: 0,
    numDisplays: 0,
    numResponses: 0,
    numStarts: 0,
    responseRate: 0,
    startRate: 0,
    totalCompletedResponses: 0,
    totalDisplays: 0,
    totalResponses: 0,
  },
  createdBy: null,
  autoComplete: null,
  runOnDate: null,
  endings: [],
};

describe("SurveyStatusDropdown", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders draft status correctly", () => {
    render(
      <SurveyStatusDropdown environment={mockEnvironment} survey={{ ...baseSurvey, status: "draft" }} />
    );
    expect(screen.getByText("common.draft")).toBeInTheDocument();
    expect(screen.queryByTestId("select-container")).toBeNull();
  });

  test("disables select when status is scheduled", () => {
    render(
      <SurveyStatusDropdown environment={mockEnvironment} survey={{ ...baseSurvey, status: "scheduled" }} />
    );
    expect(screen.getByTestId("select-container")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent(
      "environments.surveys.survey_status_tooltip"
    );
  });

  test("disables select when closeOnDate is in the past", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    render(
      <SurveyStatusDropdown
        environment={mockEnvironment}
        survey={{ ...baseSurvey, status: "inProgress", closeOnDate: pastDate }}
      />
    );
    expect(screen.getByTestId("select-container")).toHaveAttribute("data-disabled", "true");
  });

  test("renders SurveyStatusIndicator for link survey", () => {
    render(
      <SurveyStatusDropdown
        environment={mockEnvironment}
        survey={{ ...baseSurvey, status: "inProgress", type: "link" }}
      />
    );
    const actualSelectTrigger = screen.getByTestId("actual-select-trigger");
    expect(within(actualSelectTrigger).getByTestId("survey-status-indicator")).toBeInTheDocument();
  });

  test("renders SurveyStatusIndicator when appSetupCompleted is true", () => {
    render(
      <SurveyStatusDropdown
        environment={{ ...mockEnvironment, appSetupCompleted: true }}
        survey={{ ...baseSurvey, status: "inProgress", type: "app" }}
      />
    );
    const actualSelectTrigger = screen.getByTestId("actual-select-trigger");
    expect(within(actualSelectTrigger).getByTestId("survey-status-indicator")).toBeInTheDocument();
  });

  test("does not render SurveyStatusIndicator when appSetupCompleted is false for non-link survey", () => {
    render(
      <SurveyStatusDropdown
        environment={{ ...mockEnvironment, appSetupCompleted: false }}
        survey={{ ...baseSurvey, status: "inProgress", type: "app" }}
      />
    );
    const actualSelectTrigger = screen.getByTestId("actual-select-trigger");
    expect(within(actualSelectTrigger).queryByTestId("survey-status-indicator")).toBeNull();
  });
});
