import { SurveyPlacementCard } from "@/modules/survey/editor/components/survey-placement-card";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TPlacement } from "@formbricks/types/common";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock the Placement component
vi.mock("@/modules/survey/editor/components/placement", () => ({
  Placement: vi.fn(
    ({
      currentPlacement,
      setCurrentPlacement,
      overlay,
      setOverlay,
      clickOutsideClose,
      setClickOutsideClose,
    }) => (
      <div data-testid="mock-placement">
        <p>Placement: {currentPlacement}</p>
        <p>Overlay: {overlay}</p>
        <p>ClickOutsideClose: {clickOutsideClose.toString()}</p>
        <button onClick={() => setCurrentPlacement("topLeft" as TPlacement)}>Change Placement</button>
        <button onClick={() => setOverlay("dark")}>Change Overlay Dark</button>
        <button onClick={() => setOverlay("light")}>Change Overlay Light</button>
        <button onClick={() => setClickOutsideClose(true)}>Allow Click Outside</button>
        <button onClick={() => setClickOutsideClose(false)}>Disallow Click Outside</button>
      </div>
    )
  ),
}));

// Mock useAutoAnimate
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [vi.fn()]), // Return a ref object
}));

const mockEnvironmentId = "env123";
const mockSetLocalSurvey = vi.fn();
const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  environmentId: mockEnvironmentId,
  status: "draft",
  questions: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  resultShareKey: null,
  displayPercentage: null,
  languages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
  endings: [],
  variables: [],
  hiddenFields: { enabled: false },
  segment: null,
  projectOverwrites: null, // Start with no overwrites
  closeOnDate: null,
  createdBy: null,
} as unknown as TSurvey;

describe("SurveyPlacementCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockSetLocalSurvey.mockClear();
  });

  test("renders correctly initially with no project overwrites", () => {
    render(
      <SurveyPlacementCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={mockEnvironmentId}
      />
    );

    // Open the collapsible
    fireEvent.click(screen.getByText("environments.surveys.edit.survey_placement"));

    expect(screen.getByText("environments.surveys.edit.survey_placement")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.overwrite_the_global_placement_of_the_survey")
    ).toBeInTheDocument();
    const switchControl = screen.getByRole("switch");
    expect(switchControl).toBeInTheDocument();
    expect(switchControl).not.toBeChecked();
    expect(screen.queryByTestId("mock-placement")).not.toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.to_keep_the_placement_over_all_surveys_consistent_you_can")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.set_the_global_placement_in_the_look_feel_settings")
    ).toBeInTheDocument();
  });

  test("calls setLocalSurvey when placement changes in Placement component", async () => {
    const surveyWithOverwrites: TSurvey = {
      ...mockSurvey,
      projectOverwrites: {
        placement: "bottomRight",
        darkOverlay: false,
        clickOutsideClose: false,
      },
    };
    render(
      <SurveyPlacementCard
        localSurvey={surveyWithOverwrites}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={mockEnvironmentId}
      />
    );
    // Open the collapsible
    fireEvent.click(screen.getByText("environments.surveys.edit.survey_placement"));

    const changePlacementButton = screen.getByText("Change Placement");
    await userEvent.click(changePlacementButton);

    expect(mockSetLocalSurvey).toHaveBeenCalledTimes(1);
    expect(mockSetLocalSurvey).toHaveBeenCalledWith({
      ...surveyWithOverwrites,
      projectOverwrites: {
        ...surveyWithOverwrites.projectOverwrites,
        placement: "topLeft",
      },
    });
  });

  test("calls setLocalSurvey when overlay changes to dark in Placement component", async () => {
    const surveyWithOverwrites: TSurvey = {
      ...mockSurvey,
      projectOverwrites: {
        placement: "bottomRight",
        darkOverlay: false, // Start with light
        clickOutsideClose: false,
      },
    };
    render(
      <SurveyPlacementCard
        localSurvey={surveyWithOverwrites}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={mockEnvironmentId}
      />
    );
    // Open the collapsible
    fireEvent.click(screen.getByText("environments.surveys.edit.survey_placement"));

    const changeOverlayButton = screen.getByText("Change Overlay Dark");
    await userEvent.click(changeOverlayButton);

    expect(mockSetLocalSurvey).toHaveBeenCalledTimes(1);
    expect(mockSetLocalSurvey).toHaveBeenCalledWith({
      ...surveyWithOverwrites,
      projectOverwrites: {
        ...surveyWithOverwrites.projectOverwrites,
        darkOverlay: true, // Changed to dark
      },
    });
  });

  test("calls setLocalSurvey when overlay changes to light in Placement component", async () => {
    const surveyWithOverwrites: TSurvey = {
      ...mockSurvey,
      projectOverwrites: {
        placement: "bottomRight",
        darkOverlay: true, // Start with dark
        clickOutsideClose: false,
      },
    };
    render(
      <SurveyPlacementCard
        localSurvey={surveyWithOverwrites}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={mockEnvironmentId}
      />
    );
    // Open the collapsible
    fireEvent.click(screen.getByText("environments.surveys.edit.survey_placement"));

    const changeOverlayButton = screen.getByText("Change Overlay Light");
    await userEvent.click(changeOverlayButton);

    expect(mockSetLocalSurvey).toHaveBeenCalledTimes(1);
    expect(mockSetLocalSurvey).toHaveBeenCalledWith({
      ...surveyWithOverwrites,
      projectOverwrites: {
        ...surveyWithOverwrites.projectOverwrites,
        darkOverlay: false, // Changed to light
      },
    });
  });

  test("calls setLocalSurvey when clickOutsideClose changes to true in Placement component", async () => {
    const surveyWithOverwrites: TSurvey = {
      ...mockSurvey,
      projectOverwrites: {
        placement: "bottomRight",
        darkOverlay: false,
        clickOutsideClose: false, // Start with false
      },
    };
    render(
      <SurveyPlacementCard
        localSurvey={surveyWithOverwrites}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={mockEnvironmentId}
      />
    );
    // Open the collapsible
    fireEvent.click(screen.getByText("environments.surveys.edit.survey_placement"));

    const allowClickOutsideButton = screen.getByText("Allow Click Outside");
    await userEvent.click(allowClickOutsideButton);

    expect(mockSetLocalSurvey).toHaveBeenCalledTimes(1);
    expect(mockSetLocalSurvey).toHaveBeenCalledWith({
      ...surveyWithOverwrites,
      projectOverwrites: {
        ...surveyWithOverwrites.projectOverwrites,
        clickOutsideClose: true, // Changed to true
      },
    });
  });

  test("calls setLocalSurvey when clickOutsideClose changes to false in Placement component", async () => {
    const surveyWithOverwrites: TSurvey = {
      ...mockSurvey,
      projectOverwrites: {
        placement: "bottomRight",
        darkOverlay: false,
        clickOutsideClose: true, // Start with true
      },
    };
    render(
      <SurveyPlacementCard
        localSurvey={surveyWithOverwrites}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={mockEnvironmentId}
      />
    );
    // Open the collapsible
    fireEvent.click(screen.getByText("environments.surveys.edit.survey_placement"));

    const disallowClickOutsideButton = screen.getByText("Disallow Click Outside");
    await userEvent.click(disallowClickOutsideButton);

    expect(mockSetLocalSurvey).toHaveBeenCalledTimes(1);
    expect(mockSetLocalSurvey).toHaveBeenCalledWith({
      ...surveyWithOverwrites,
      projectOverwrites: {
        ...surveyWithOverwrites.projectOverwrites,
        clickOutsideClose: false, // Changed to false
      },
    });
  });

  test("does not open collapsible if survey type is link", () => {
    const linkSurvey: TSurvey = { ...mockSurvey, type: "link" };
    render(
      <SurveyPlacementCard
        localSurvey={linkSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={mockEnvironmentId}
      />
    );

    const trigger = screen.getByText("environments.surveys.edit.survey_placement");
    fireEvent.click(trigger);

    // Check if the content that should appear when open is not visible
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
