import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AddEndingCardButton } from "./add-ending-card-button";

const mockAddEndingCard = vi.fn();
const mockSetLocalSurvey = vi.fn(); // Although not used in the button click, it's a prop

const mockSurvey: TSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  environmentId: "env1",
  status: "draft",
  questions: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  surveyClosedMessage: null,
  singleUse: null,
  languages: [],
  styling: null,
  variables: [],
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  endings: [], // Start with an empty endings array
  hiddenFields: { enabled: false },
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  segment: null,
  resultShareKey: null,
  displayPercentage: null,
  closeOnDate: null,
  runOnDate: null,
} as unknown as TSurvey;

describe("AddEndingCardButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks(); // Clear mocks after each test
  });

  test("renders the button correctly", () => {
    render(
      <AddEndingCardButton
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        addEndingCard={mockAddEndingCard}
      />
    );

    // Check for the Tolgee translated text
    expect(screen.getByText("environments.surveys.edit.add_ending")).toBeInTheDocument();
  });

  test("calls addEndingCard with the correct index when clicked", async () => {
    const user = userEvent.setup();
    const surveyWithEndings = { ...mockSurvey, endings: [{}, {}] } as unknown as TSurvey; // Survey with 2 endings

    render(
      <AddEndingCardButton
        localSurvey={surveyWithEndings}
        setLocalSurvey={mockSetLocalSurvey}
        addEndingCard={mockAddEndingCard}
      />
    );

    const button = screen.getByText("environments.surveys.edit.add_ending").closest("div.group");
    expect(button).toBeInTheDocument();

    if (button) {
      await user.click(button);
      // Should be called with the current length of the endings array
      expect(mockAddEndingCard).toHaveBeenCalledTimes(1);
      expect(mockAddEndingCard).toHaveBeenCalledWith(2);
    }
  });

  test("calls addEndingCard with index 0 when no endings exist", async () => {
    const user = userEvent.setup();
    render(
      <AddEndingCardButton
        localSurvey={mockSurvey} // Survey with 0 endings
        setLocalSurvey={mockSetLocalSurvey}
        addEndingCard={mockAddEndingCard}
      />
    );

    const button = screen.getByText("environments.surveys.edit.add_ending").closest("div.group");
    expect(button).toBeInTheDocument();

    if (button) {
      await user.click(button);
      // Should be called with index 0
      expect(mockAddEndingCard).toHaveBeenCalledTimes(1);
      expect(mockAddEndingCard).toHaveBeenCalledWith(0);
    }
  });
});
